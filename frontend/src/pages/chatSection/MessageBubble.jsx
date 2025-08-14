import React, { useRef, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { FaCheck, FaCheckDouble, FaPlus, FaSmile } from 'react-icons/fa';
import { HiDotsVertical } from 'react-icons/hi'
import useOutsideClick from '../../hooks/useOutsideClick';
import EmojiPicker from 'emoji-picker-react';
import { RxCross2 } from 'react-icons/rx'

const MessageBubble = ({ message, theme, onReact, currentUser, deleteMessage }) => {
    const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    const messageRef = useRef(null);
    const optionsRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const reactionsMenuRef = useRef(null);

    const isUserMessage = message.sender._id === currentUser?._id;
    const bubbleClass = isUserMessage ? `chat-end` : `chat-start`

    const bubbleContentClass = isUserMessage
        ? `chat-bubble md:max-w-[50%] min-w-[130px] ${theme === 'dark' ? "bg-[#144d38] text-white" : "bg-[#d9fdd3] text-black"}`
        : `chat-bubble md:max-w-[50%] min-w-[130px] ${theme === 'dark' ? "bg-[#144d38] text-white" : "bg-white text-black"}`;

    const handleReact = (emoji) => {
        onReact(message._id, emoji)
        setShowEmojiPicker(false)
        setShowReactions(false)
    }

    const handleCopyMessage = () => {
        if (message.content) {
            navigator.clipboard.writeText(message.content)
                .then(() => {
                    console.log("Message copied!");
                })
                .catch(() => {
                    console.log("Failed to copy message.");
                });
        }
        setShowOptions(false);
    }

    useOutsideClick(emojiPickerRef, () => {
        if (showEmojiPicker) setShowEmojiPicker(false)
    })
    useOutsideClick(reactionsMenuRef, () => {
        if (showReactions) setShowReactions(false)
    })
    useOutsideClick(optionsRef, () => {
        if (showOptions) setShowOptions(false)
    })

    useEffect(() => {
        console.log('MessageBubble re-render for message:', message._id);
    }, [message.reactions, message._id]);

    if (message === 0) return null;

    const processedReactions = React.useMemo(() => {
        if (!message.reactions || !Array.isArray(message.reactions)) return {};
        const reactionMap = {};
        message.reactions.forEach(reaction => {
            if (reaction?.emoji) {
                if (!reactionMap[reaction.emoji]) {
                    reactionMap[reaction.emoji] = { count: 0, users: [] };
                }
                reactionMap[reaction.emoji].count++;
                reactionMap[reaction.emoji].users.push(reaction.userId);
            }
        });
        return reactionMap;
    }, [message.reactions]);

    const hasReactions = Object.keys(processedReactions).length > 0;

    return (
        <div className={`chat ${bubbleClass} ${hasReactions ? 'mb-4' : ''}`}>
            <div className={`${bubbleContentClass} relative group`} ref={messageRef}>
                <div className='flex justify-center gap-2'>
                    {message.contentType === 'text' && <p className='mr-2'>{message.content}</p>}
                    {message.contentType === 'image' && (
                        <div>
                            <img src={message.imageOrVideoUrl} alt="images-video" className='rounded-lg max-w-xs' />
                            <p className='mt-1'>{message.content}</p>
                        </div>
                    )}
                </div>

                {/* Time and ticks */}
                <div className='self-end flex items-center justify-end gap-1 text-xs opacity-60 mt-2 ml-2'>
                    <span>{format(new Date(message.createdAt), "HH:mm")}</span>
                    {isUserMessage && (
                        <>
                            {message.messageStatus === "send" && <FaCheck size={12} />}
                            {message.messageStatus === "delivered" && <FaCheckDouble size={12} />}
                            {message.messageStatus === "read" && <FaCheckDouble className='text-blue-500' size={12} />}
                        </>
                    )}
                </div>

                {/* 3 dots button */}
                <div className='absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20'>
                    <button onClick={() => setShowOptions(prev => !prev)}
                        className={`p-1 rounded-full ${theme === 'dark' ? "text-white" : "text-gray-800"}`}>
                        <HiDotsVertical size={18} />
                    </button>
                </div>

                {/* Options dropdown */}
                {showOptions && (
                    <div
                        ref={optionsRef}
                        className={`absolute top-6 right-0 w-32 rounded-lg shadow-lg z-50 overflow-hidden
                        ${theme === 'dark' ? 'bg-[#2a3942] text-white' : 'bg-white text-black'}`}
                    >
                        <button
                            onClick={handleCopyMessage}
                            className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors
                            ${theme === 'dark'
                                ? 'hover:bg-gray-700 hover:text-gray-100'
                                : 'hover:bg-gray-100 hover:text-gray-800'}`}
                        >
                            📋 Copy
                        </button>
                        {isUserMessage && (
                            <button
                                onClick={() => { deleteMessage(message._id); setShowOptions(false); }}
                                className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors
                                ${theme === 'dark'
                                    ? 'hover:bg-red-600 text-red-400 hover:text-white'
                                    : 'hover:bg-red-100 text-red-500 hover:text-red-700'}`}
                            >
                                🗑 Delete
                            </button>
                        )}
                    </div>
                )}

                {/* Reaction button */}
                <div className={`absolute ${isUserMessage ? "-left-10" : "-right-10"} top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2`}>
                    <button
                        onClick={() => setShowReactions(true)}
                        className={`p-2 rounded-full ${theme === "dark" ? "bg-[#202c33] hover:bg-[#202c33]/80" : "bg-white hover:bg-gray-100"} shadow-lg`}
                    >
                        <FaSmile className={`${theme === 'dark' ? "text-gray-300" : "text-gray-600"}`} />
                    </button>
                </div>

                {/* Quick reactions */}
                {showReactions && (
                    <div ref={reactionsMenuRef}
                        className={`absolute -top-12 ${isUserMessage ? "left-0" : "right-0"} transform ${isUserMessage ? "-translate-x-1/2" : "translate-x-1/2"} flex items-center bg-[#202c33]/90 rounded-full px-2 py-1.5 gap-1 shadow-lg z-50`}>
                        {quickReactions.map((emoji, index) => (
                            <button key={index}
                                onClick={() => handleReact(emoji)}
                                className='hover:scale-125 transition-transform p-1'>
                                {emoji}
                            </button>
                        ))}
                        <div className='w-[1px] h-5 bg-gray-600 mx-1' />
                        <button className='hover:bg-[#ffffff1a] rounded-full p-1' onClick={() => setShowEmojiPicker(true)}>
                            <FaPlus className='h-4 w-4 text-gray-300' />
                        </button>
                    </div>
                )}

                {/* Emoji Picker */}
                {showEmojiPicker && (
                    <div ref={emojiPickerRef} className={`absolute ${isUserMessage ? "left-0" : "right-0"} -top-2 z-50`}>
                        <div className='relative'>
                            <EmojiPicker onEmojiClick={(emojiObject) => handleReact(emojiObject.emoji)} theme={theme} />
                            <button
                                onClick={() => setShowEmojiPicker(false)}
                                className='absolute top-2 right-2 text-gray-500 hover:text-gray-700'>
                                <RxCross2 />
                            </button>
                        </div>
                    </div>
                )}

                {/* Display reactions */}
                {hasReactions && (
                    <div className={`absolute ${isUserMessage ? "right-0" : "left-0"} -bottom-7 ${theme === 'dark' ? "bg-[#2a3942] border border-gray-600" : "bg-white border border-gray-300"} rounded-full px-3 py-1.5 shadow-lg z-10 flex items-center gap-2 min-w-max`}>
                        {Object.entries(processedReactions).map(([emoji, data], index) => (
                            <div key={index} className='flex items-center gap-1'>
                                <span className='text-base leading-none'>{emoji}</span>
                                {data.count > 1 && (
                                    <span className={`text-xs font-medium leading-none ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                        {data.count}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className={hasReactions ? 'pb-8' : ''}></div>
            </div>
        </div>
    )
}

export default MessageBubble
