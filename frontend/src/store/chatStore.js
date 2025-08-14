import { getSocket } from "../services/chat.service"
import axiosInstance from "../services/url.service"
import { create } from "zustand";

export const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,
  error: null,
  onlineUsers: new Map(),
  typingUsers: new Map(),

  //socket event listener setup
  initisocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    // remove existing listeners to prevent duplicates
    socket.off('receive_message');
    socket.off('user_typing');
    socket.off('user_status');
    socket.off('message_send');
    socket.off('message_error');
    socket.off('message_deleted');
    socket.off('message_status_update');
    socket.off('reaction_update');

    // listen for incoming messages
    socket.on('receive_message', (message) => {
      const { receiveMessage } = get();
      receiveMessage(message);
    });

    // confirm message delivery
    socket.on('message_send', (message) => {
      set((state) => ({
        messages: state.messages.map((msg) => (msg._id === message._id ? { ...msg } : msg)),
      }));
    });

    // update message status
    socket.on('message_status_update', ({ messageId, messageStatus }) => {
      set((state) => ({
        messages: state.messages.map((msg) => (msg._id === messageId ? { ...msg, messageStatus } : msg)),
      }));
    });

    // handle reaction update - FIXED VERSION WITH NO SCROLL JUMP
    socket.on('reaction_update', ({ messageId, reactions }) => {
      console.log('Reaction update received:', { messageId, reactions });
      
      set((state) => {
        const messageIndex = state.messages.findIndex(msg => msg._id === messageId);
        if (messageIndex === -1) {
          console.log('Message not found for reaction update:', messageId);
          return state;
        }
        
        // Create new messages array with minimal changes
        const updatedMessages = [...state.messages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          reactions: Array.isArray(reactions) ? reactions : []
        };
        
        console.log('Updated message reactions:', updatedMessages[messageIndex].reactions);
        return { messages: updatedMessages };
      });
    });

    // handle remove message from local state
    socket.on('message_deleted', ({ deletedMessageId }) => {
      set((state) => ({
        messages: state.messages.filter((msg) => msg._id !== deletedMessageId),
      }));
    });

    // handle any message send error
    socket.on('message_error', (error) => {
      console.error('Message send error:', error);
    });

    // listener for typing users
    socket.on('user_typing', ({ userId, conversationId, isTyping }) => {
      set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        if (!newTypingUsers.has(conversationId)) {
          newTypingUsers.set(conversationId, new Set());
        }
        const typingSet = newTypingUsers.get(conversationId);
        if (isTyping) {
          typingSet.add(userId);
        } else {
          typingSet.delete(userId);
        }
        return { typingUsers: newTypingUsers };
      });
    });

    // track users online/offline status
    socket.on('user_status', ({ userId, isOnline, lastSeen }) => {
      set((state) => {
        const newOnlineUsers = new Map(state.onlineUsers);
        newOnlineUsers.set(userId, { isOnline, lastSeen });
        return { onlineUsers: newOnlineUsers };
      });
    });

    //emit status chk for all users in convo list
    const { conversations } = get();
    if (Array.isArray(conversations?.data) && conversations?.data.length > 0) {
      conversations.data?.forEach((conv) => {
        const otherUser = conv.participants.find(
          (p) => p._id !== get().currentUser._id
        );
        if (otherUser._id) {
          socket.emit("get_user_status", otherUser._id, (status) => {
            set((state) => {
              const newOnlineUsers = new Map(state.onlineUsers);
              newOnlineUsers.set(status.userId, {
                isOnline: status.isOnline,
                lastSeen: status.lastSeen
              });
              return { onlineUsers: newOnlineUsers }
            })
          })
        }
      })
    }
  },

  setCurrentUser: (user) => {
    console.log('Setting current user in chat store:', user);
    set({ currentUser: user });
  },

  fetchConversations: async () => {
    set({ loading: true, error: null });

    try {
      const { data } = await axiosInstance.get("/chat/conversations");
      set({ conversations: data, loading: false });

      get().initisocketListeners();
      return data;
    } catch (error) {
      set({
        error: error?.response?.data?.message || error.message,
        loading: false
      });
      return null;
    }
  },

  //fetch msg for convo
  fetchMessages: async (conversationId) => {
    if (!conversationId) return;
    set({ loading: true, error: null })
    try {
      const { data } = await axiosInstance.get(`/chat/conversations/${conversationId}/messages`);
      const messageArray = data.data || data || [];
      
      // Ensure reactions are properly initialized for each message
      const messagesWithReactions = messageArray.map(msg => ({
        ...msg,
        reactions: msg.reactions || []
      }));
      
      set({
        messages: messagesWithReactions,
        currentConversation: conversationId,
        loading: false
      })

      //mark as read
      const { markMessagesAsRead } = get();
      markMessagesAsRead();

      return messagesWithReactions;
    } catch (error) {
      set({
        error: error?.response?.data?.message || error.message,
        loading: false
      })
      return [];
    }
  },

  //send message in real time
  sendMessage: async (formData) => {
    const senderId = formData.get("senderId")
    const receiverId = formData.get("receiverId");
    const media = formData.get("media")
    const content = formData.get("content")
    const messageStatus = formData.get("messageStatus")

    const socket = getSocket();
    const { conversations } = get();
    let conversationId = null;
    if (Array.isArray(conversations?.data) && conversations.data.length > 0) {
      const conversation = conversations.data.find((conv) =>
        conv.participants.some((p) => p._id === senderId) &&
        conv.participants.some((p) => p._id === receiverId));
      if (conversation) {
        conversationId = conversation._id;
        set({ currentConversation: conversationId })
      }
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      sender: { _id: senderId },
      receiver: { _id: receiverId },
      conversation: conversationId,
      imageOrVideoUrl: media && typeof media !== 'string' ? URL.createObjectURL(media) : null,
      content: content,
      contentType: media ? (media.type.startsWith("image") ? "image" : "video") : "text",
      createdAt: new Date().toISOString(),
      messageStatus,
      reactions: [] // Initialize reactions array
    };

    set((state) => ({
      messages: [...state.messages, optimisticMessage]
    }))

    try {
      const { data } = await axiosInstance.post("/chat/send-message", formData,
        { headers: { "content-Type": "multipart/form-data" } });
      const messageData = data.data || data;
      
      // Ensure reactions are initialized in the real message too
      const messageWithReactions = {
        ...messageData,
        reactions: messageData.reactions || []
      };
      
      //replace optimistic msg with real one
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === tempId ? messageWithReactions : msg)
      }));
      return messageWithReactions;
    } catch (error) {
      console.error("Error sending message", error)
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === tempId ? { ...msg, messageStatus: "failed" } : msg),
        error: error?.response?.data?.message || error.message,
      }));
      throw error;
    }
  },

  receiveMessage: (message) => {
    if (!message) return;
    const { currentConversation, currentUser, messages } = get();

    const messageExists = Array.isArray(messages) && messages.some((msg) => msg._id === message._id);
    if (messageExists) return;

    // Ensure reactions are initialized for received messages
    const messageWithReactions = {
      ...message,
      reactions: message.reactions || []
    };

    if (message.conversation === currentConversation) {
      set((state) => ({
        messages: [...state.messages, messageWithReactions]
      }));

      // automatically mark as read
      if (message.receiver?._id === currentUser?._id) {
        get().markMessagesAsRead()
      }
    }

    //update convo preview and unread count
    set((state) => {
      const updateConversations = state.conversations?.data?.map((conv) => {
        if (conv._id === message.conversation) {
          return {
            ...conv,
            lastMessage: message,
            unreadCount: message?.receiver?._id === currentUser?._id
              ? (conv.unreadCount || 0) + 1
              : conv.unreadCount || 0
          }
        }
        return conv;
      })

      return {
        conversations: {
          ...state.conversations,
          data: updateConversations,
        }
      }
    })
  },

  //mark as read
  markMessagesAsRead: async () => {
    const { messages, currentUser } = get();
    if (!Array.isArray(messages) || messages.length === 0 || !currentUser) return;
    
    const unreadIds = messages
      .filter((msg) => msg.messageStatus !== 'read' && msg.receiver?._id === currentUser?._id)
      .map((msg) => msg._id)
      .filter(Boolean);

    if (unreadIds.length === 0) return;
    
    try {
      const { data } = await axiosInstance.put("/chat/messages/read", {
        messageIds: unreadIds
      });
      console.log("mark as read", data)
      
      set((state) => ({
        messages: state.messages.map((msg) => 
          unreadIds.includes(msg._id) ? { ...msg, messageStatus: "read" } : msg)
      }));

      const socket = getSocket();
      if (socket) {
        socket.emit("message_read", {
          messageIds: unreadIds,
          senderId: messages[0]?.sender?._id
        })
      }
    } catch (error) {
      console.error("failed to mark message as read", error)
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/chat/messages/${messageId}`);
      set((state) => ({
        messages: state.messages?.filter((msg) => msg?._id !== messageId)
      }))
      return true;
    } catch (error) {
      console.log("Error deleting message", error)
      set({ error: error.response?.data?.message || error.message })
      return false;
    }
  },

  ///add/change reaction - IMPROVED VERSION WITH NO SCROLL JUMP
  addReaction: async (messageId, emoji) => {
    const socket = getSocket();
    const { currentUser } = get();
    console.log('Adding reaction:', { messageId, emoji, currentUser });
    
    if (socket && currentUser) {
      // Optimistically update the UI first WITHOUT triggering re-renders that cause scroll
      set((state) => {
        const messageIndex = state.messages.findIndex(msg => msg._id === messageId);
        if (messageIndex === -1) return state;
        
        const message = state.messages[messageIndex];
        const existingReactions = Array.isArray(message.reactions) ? [...message.reactions] : [];
        const userReactionIndex = existingReactions.findIndex(
          reaction => reaction.userId === currentUser._id
        );
        
        let newReactions;
        if (userReactionIndex !== -1) {
          // User already reacted, update their reaction
          newReactions = existingReactions.map((reaction, index) =>
            index === userReactionIndex ? { ...reaction, emoji } : reaction
          );
        } else {
          // Add new reaction
          newReactions = [...existingReactions, {
            userId: currentUser._id,
            emoji,
            createdAt: new Date().toISOString()
          }];
        }
        
        // Create new messages array with updated message
        const updatedMessages = [...state.messages];
        updatedMessages[messageIndex] = { ...message, reactions: newReactions };
        
        return { messages: updatedMessages };
      });
      
      // Then emit to server
      socket.emit("add_reaction", {
        messageId,
        emoji,
        userId: currentUser?._id
      });
    }
  },

  startTyping: (receiverId) => {
    const { currentConversation } = get();
    const socket = getSocket();
    if (socket && currentConversation && receiverId) {
      socket.emit("typing_start", {
        conversationId: currentConversation,
        receiverId
      })
    }
  },

  stopTyping: (receiverId) => {
    const { currentConversation } = get();
    const socket = getSocket();
    if (socket && currentConversation && receiverId) {
      socket.emit("typing_stop", {
        conversationId: currentConversation,
        receiverId
      })
    }
  },

  isUserTyping: (userId) => {
    const { typingUsers, currentConversation } = get();
    if (!currentConversation || !typingUsers.has(currentConversation) || !userId) {
      return false;
    }
    return typingUsers.get(currentConversation).has(userId)
  },

  isUserOnline: (userId) => {
    if (!userId) return null;
    const { onlineUsers } = get();
    return onlineUsers.get(userId)?.isOnline || false;
  },

  getUserLastSeen: (userId) => {
    if (!userId) return null;
    const { onlineUsers } = get();
    return onlineUsers.get(userId)?.lastSeen || false;
  },

  cleanUp: () => {
    set({
      conversations: [],
      currentConversation: null,
      messages: [],
      onlineUsers: new Map(),
      typingUsers: new Map(),
    })
  }
}));