// ====== server.js ======
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const CHAT_FILE = "chat.json";
const GEMINI_API_KEY = "API_KEY_GEMINI";   // <--- THAY KEY CỦA BẠN

// Tạo file nếu chưa tồn tại
if (!fs.existsSync(CHAT_FILE)) {
    fs.writeFileSync(CHAT_FILE, "[]");
}

// Lấy tin nhắn
app.get("/messages", (req, res) => {
    const data = fs.readFileSync(CHAT_FILE, "utf8");
    res.json(JSON.parse(data));
});

// Gửi tin nhắn + chatbot trả lời
app.post("/messages", async (req, res) => {
    const { name, text } = req.body;

    if (!name || !text) {
        return res.status(400).json({ error: "Thiếu tên hoặc nội dung." });
    }

    let messages = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));

    // Lưu tin nhắn người dùng
    messages.push({ sender: name, text });

    // Gọi Gemini API
    let botReply = "Bot gặp lỗi.";

    try {
        const result = await axios.post(
            "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY,
            {
                contents: [
                    { parts: [{ text }] }
                ]
            }
        );

        botReply = result.data.candidates[0].c

