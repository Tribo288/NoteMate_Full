const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const GROUP_FILE = "group.json";
const GEMINI_API_KEY = "API_KEY_GEMINI"; // <-- Thay bằng key của bạn

// Tạo file group chat nếu chưa tồn tại
if (!fs.existsSync(GROUP_FILE)) {
    fs.writeFileSync(GROUP_FILE, "[]");
}

// Lấy tin nhắn nhóm
app.get("/groupMessages", (req, res) => {
    const data = fs.readFileSync(GROUP_FILE, "utf8");
    res.json(JSON.parse(data));
});

// Gửi tin nhắn nhóm
app.post("/groupMessages", (req, res) => {
    const { name, text } = req.body;
    if (!name || !text) return res.status(400).json({ error: "Thiếu tên hoặc nội dung." });

    let messages = JSON.parse(fs.readFileSync(GROUP_FILE, "utf8"));
    messages.push({ sender: name, text });
    fs.writeFileSync(GROUP_FILE, JSON.stringify(messages, null, 2));

    res.json({ success: true });
});

// Chatbot AI (không lưu tin nhắn)
app.post("/bot", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Thiếu nội dung." });

    let botReply = "Bot gặp lỗi khi xử lý.";

    try {
        const result = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateMessage?key=${GEMINI_API_KEY}`,
            {
                prompt: { text },
                temperature: 0.7
            },
            { headers: { "Content-Type": "application/json" } }
        );

        botReply = result.data.candidates?.[0]?.content || "Bot không trả lời";
    } catch (err) {
        console.log("Gemini API Error:", err.response?.data || err.message);
    }

    res.json({ sender: "Bot", text: botReply });
});

// Cho index.html chạy trực tiếp
app.use(express.static("."));

// Port động cho Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));
