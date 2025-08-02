import nodeMailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

function getGeneralEmailTemplate(data) {
  const year = new Date().getFullYear();
  const storeName = "TapAndDraw"; 

  return `
    <div style="font-family:Segoe UI, sans-serif; max-width:600px; margin:auto; padding:20px; background:#ffffff; border-radius:8px; box-shadow:0 0 10px rgba(0,0,0,0.05);">
      <h2 style="color:#333;">${data.title || "Hello!"}</h2>
      <p style="font-size:15px; color:#555;">${data.message || ""}</p>

      ${
        data.ctaLink
          ? `<a href="${data.ctaLink}" style="display:inline-block; margin-top:20px; padding:10px 15px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">${data.ctaText || "Click Here"}</a>`
          : ""
      }

      <p style="margin-top: 30px; font-size: 12px; color: #999;">&copy; ${year} ${storeName}</p>
    </div>
  `;
}

const transporter = nodeMailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    }
});
export const sendEmail = async (to, subject, text) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL,
            to,
            subject,
            html: getGeneralEmailTemplate({
                title: subject,
                message: text,
                ctaText: "",
                ctaLink: ""
            })
        };
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending email');
    }
};
export const sendOrderConfirmationEmail = async (to, orderId) => {
    const subject = 'Order Confirmation';
    const text = `Your order with ID ${orderId} has been placed successfully!`;
    await sendEmail(to, subject, text);
}
export const sendOrderStatusUpdateEmail = async (to, orderId, status) => {
    const subject = 'Order Status Update';
    const text = `Your order with ID ${orderId} is now ${status}.`;
    await sendEmail(to, subject, text);
}
export const sendOrderCancellationEmail = async (to, orderId) => {
    const subject = 'Order Cancellation';
    const text = `Your order with ID ${orderId} has been cancelled.`;
    await sendEmail(to, subject, text);
}
export const sendOrderDeliveryEmail = async (to, orderId) => {
    const subject = 'Order Delivery Confirmation';
    const text = `Your order with ID ${orderId} has been delivered.`;
    await sendEmail(to, subject, text);
}
export const sendOrderRefundEmail = async (to, orderId) => {
    const subject = 'Order Refund Confirmation';
    const text = `Your order with ID ${orderId} has been refunded.`;
    await sendEmail(to, subject, text);
}
export const sendOrderReturnEmail = async (to, orderId) => {
    const subject = 'Order Return Confirmation';
    const text = `Your order with ID ${orderId} has been returned.`;
    await sendEmail(to, subject, text);
}
export const sendOrderExchangeEmail = async (to, orderId) => {
    const subject = 'Order Exchange Confirmation';
    const text = `Your order with ID ${orderId} has been exchanged.`;
    await sendEmail(to, subject, text);
}
export const sendOrderTrackingEmail = async (to, orderId, trackingInfo) => {
    const subject = 'Order Tracking Information';
    const text = `Your order with ID ${orderId} is being tracked. Tracking information: ${trackingInfo}`;
    await sendEmail(to, subject, text);
}
export const sendOrderFeedbackEmail = async (to, orderId) => {
    const subject = 'Order Feedback Request';
    const text = `We would love to hear your feedback on your order with ID ${orderId}.`;
    await sendEmail(to, subject, text);
}
export const sendOrderReviewEmail = async (to, orderId) => {
    const subject = 'Order Review Request';
    const text = `Please leave a review for your order with ID ${orderId}.`;
    await sendEmail(to, subject, text);
}
export const sendOrderReminderEmail = async (to, orderId) => {
    const subject = 'Order Reminder';
    const text = `This is a reminder for your order with ID ${orderId}.`;
    await sendEmail(to, subject, text);
}
