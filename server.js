const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const GROUP_FILE = "group.json";

// Lấy Key từ biến môi trường của Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Tạo file group chat ảo nếu chưa tồn tại
if (!fs.existsSync(GROUP_FILE)) {
    try {
        fs.writeFileSync(GROUP_FILE, "[]");
    } catch (e) {
        console.error("Không thể tạo file group.json:", e);
    }
}

// 1. API Lấy tin nhắn nhóm
app.get("/groupMessages", (req, res) => {
    try {
        if (!fs.existsSync(GROUP_FILE)) return res.json([]);
        const data = fs.readFileSync(GROUP_FILE, "utf8");
        res.json(data ? JSON.parse(data) : []);
    } catch (error) {
        console.error("Lỗi đọc file group:", error);
        res.json([]);
    }
});

// 2. API Gửi tin nhắn nhóm
app.post("/groupMessages", (req, res) => {
    const { name, text } = req.body;
    if (!name || !text) return res.status(400).json({ error: "Thiếu tên hoặc nội dung." });

    try {
        let messages = [];
        if (fs.existsSync(GROUP_FILE)) {
            try {
                const fileContent = fs.readFileSync(GROUP_FILE, "utf8");
                messages = JSON.parse(fileContent);
            } catch (e) { messages = []; }
        }

        messages.push({ sender: name, text });
        if (messages.length > 50) messages = messages.slice(-50);

        fs.writeFileSync(GROUP_FILE, JSON.stringify(messages, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error("Lỗi lưu tin nhắn:", error);
        res.json({ success: false });
    }
});

// 3. API Chatbot AI
app.post("/bot", async (req, res) => {
    const { text } = req.body;
    console.log("User hỏi:", text);

    if (!GEMINI_API_KEY) {
        return res.json({ 
            sender: "Bot", 
            text: "Lỗi Server: Chưa cài đặt API Key trong Environment Variables." 
        });
    }

    try {
        // --- CẬP NHẬT QUAN TRỌNG: Dùng 'gemini-1.5-flash-latest' ---
        // Nếu vẫn lỗi, bạn hãy thử đổi dòng dưới thành: 'gemini-1.0-pro'
        const modelName = "gemini-1.5-flash-latest";
        
        const result = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{ text: text }]
                }]
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const botReply = result.data.candidates?.[0]?.content?.parts?.[0]?.text || "Bot không nghĩ ra câu trả lời.";
        res.json({ sender: "Bot", text: botReply });

    } catch (err) {
        console.error("---------------- LỖI GEMINI API ----------------");
        // In lỗi chi tiết ra log để debug
        console.error(err.response?.data || err.message);
        console.error("------------------------------------------------");
        
        res.json({ 
            sender: "Bot", 
            text: "Xin lỗi, Bot đang gặp sự cố kết nối. Vui lòng thử lại sau." 
        });
    }
});

// Serve file tĩnh (index.html, style, v.v.)
app.use(express.static("."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server đang chạy tại port ${PORT}`));
