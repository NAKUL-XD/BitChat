const response = (res, statusCode, message, data = null) => {
  if (!res) {
    console.error("Response object is required");
    return;
  }

  const responseObject = {
    status: statusCode < 400 ? "success" : "error", // Clear status flag
    message,
    data,
  };

  return res.status(statusCode).json(responseObject);
};

module.exports = response;
