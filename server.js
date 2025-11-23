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

// Tạo file data ảo nếu chưa có (Render không cho lưu file vĩnh viễn, nên mỗi lần restart sẽ mất tin nhắn nhóm cũ - đây là đặc tính của gói Free)
if (!fs.existsSync(GROUP_FILE)) {
    fs.writeFileSync(GROUP_FILE, "[]");
}

app.get("/groupMessages", (req, res) => {
    try {
        if (!fs.existsSync(GROUP_FILE)) return res.json([]);
        const data = fs.readFileSync(GROUP_FILE, "utf8");
        res.json(data ? JSON.parse(data) : []);
    } catch (e) { res.json([]); }
});

app.post("/groupMessages", (req, res) => {
    const { name, text } = req.body;
    if (!name || !text) return res.status(400).json({ error: "Thiếu dữ liệu" });
    
    try {
        let messages = [];
        if (fs.existsSync(GROUP_FILE)) {
            messages = JSON.parse(fs.readFileSync(GROUP_FILE, "utf8"));
        }
        messages.push({ sender: name, text });
        fs.writeFileSync(GROUP_FILE, JSON.stringify(messages, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Lỗi lưu file" }); }
});

// API CHATBOT
app.post("/bot", async (req, res) => {
    const { text } = req.body;
    console.log("User hỏi:", text); // Xem trong Log của Render

    if (!GEMINI_API_KEY) {
        console.error("LỖI: Chưa cài đặt biến môi trường GEMINI_API_KEY trên Render!");
        return res.json({ sender: "Bot", text: "Lỗi Server: Chủ web chưa cài đặt API Key trong phần Environment." });
    }

    try {
        const result = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: text }] }] },
            { headers: { "Content-Type": "application/json" } }
        );

        const reply = result.data.candidates?.[0]?.content?.parts?.[0]?.text || "Bot không có câu trả lời.";
        res.json({ sender: "Bot", text: reply });

    } catch (err) {
        console.error("Gemini API Lỗi:", err.response?.data || err.message);
        res.json({ sender: "Bot", text: "Bot đang quá tải hoặc lỗi kết nối." });
    }
});

app.use(express.static("."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Render started on port ${PORT}`));
