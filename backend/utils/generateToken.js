const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
   return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '1y' // Token will expire in 30 days
    })
    
 } ;

 module.exports = generateToken;
