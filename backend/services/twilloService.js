const twilio = require('twilio');

//credentials from env

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

const client = twilio(accountSid, authToken);




const sendOtpToPhoneNumber = async (phoneNumber) => {
    try {
        console.log("Sending OTP to phone number:", phoneNumber);
        if (!phoneNumber) {
            throw new Error("Phone number is required");
        }
        const response = await client.verify.v2.services(serviceSid)
            .verifications
            .create({ to: phoneNumber, channel: 'sms' });
        console.log("OTP sent successfully:", response);
        return response;
    } catch (error) {
        console.error("Error sending OTP:", error);
        throw new Error("Failed to send OTP. Please try again later.");

    }
}

const verifyOtp = async (phoneNumber, otp) => {
    try {
        console.log("this is my otp", otp);
        console.log("sending otp to phone number:", phoneNumber);


        const response = await client.verify.v2.services(serviceSid)
            .verificationChecks
            .create({ to: phoneNumber, code: otp });
        console.log("OTP verified successfully:", response);
        return response;
    } catch (error) {
        console.error( error);
        throw new Error("Failed to verify OTP. Please try again later.");

    }
};

module.exports = {
    sendOtpToPhoneNumber,
    verifyOtp   
};



