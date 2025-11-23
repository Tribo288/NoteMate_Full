// ====== server.js ======
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const CHAT_FILE = "chat.json";
const GEMINI_API_KEY = "API_KEY_CUA_BAN";   // <-- ĐỔI LẠI API KEY

// Nếu chưa có file thì tạo mới
if (!fs.existsSync(CHAT_FILE)) {
    fs.writeFileSync(CHAT_FILE, "[]");
}

// Lấy toàn bộ tin nhắn
app.get("/messages", (req, res) => {
    const data = fs.readFileSync(CHAT_FILE, "utf8");
    res.json(JSON.parse(data));
});

// Gửi tin nhắn + AI trả lời
app.post("/messages", async (req, res) => {
    const { name, text } = req.body;

    if (!name || !text) {
        return res.status(400).json({ error: "Thiếu tên hoặc nội dung." });
    }

    let messages = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));

    // Lưu tin nhắn của người dùng
    messages.push({ sender: name, text });

    // Gọi API Gemini
    let botReply = "Bot gặp lỗi khi xử lý.";

    try {
        const result = await axios.post(
            "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY,
            {
                contents: [
                    {
                        parts: [
                            { text: text }
                        ]
                    }
                ]
            }
        );

        // Trả lời của Gemini
        botReply = result.data.candidates[0].content.parts[0].text || "Bot không trả lời.";
    } catch (err) {
        console.log("Gemini API Error:", err.message);
    }

    // Lưu tin nhắn bot
    messages.push({ sender: "Bot", text: botReply });

    // Ghi lại file
    fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2));

    res.json({ success: true });
});

// Cho trang index.html chạy trực tiếp
app.use(express.static("."));

// Render bắt buộc dùng port động
const PORT = process.env.PORT || 3000;
app.listen(PORT, (
