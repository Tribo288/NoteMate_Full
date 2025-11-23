const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const GROUP_FILE = "group.json";

// ============================================================
// QUAN TRỌNG: Hãy dán API Key Gemini của bạn vào dòng dưới đây
const GEMINI_API_KEY = "AIzaSyAUsoZeOAMP57GpnoQWYc6Bkc364nDeG10"; 
// Ví dụ: const GEMINI_API_KEY = "AIzaSy...";
// ============================================================

// Tạo file group chat nếu chưa tồn tại
if (!fs.existsSync(GROUP_FILE)) {
    fs.writeFileSync(GROUP_FILE, "[]");
}

// API: Lấy tin nhắn nhóm
app.get("/groupMessages", (req, res) => {
    try {
        if (!fs.existsSync(GROUP_FILE)) {
            fs.writeFileSync(GROUP_FILE, "[]");
            return res.json([]);
        }
        const data = fs.readFileSync(GROUP_FILE, "utf8");
        // Nếu file rỗng thì trả về mảng rỗng để tránh lỗi
        if (!data.trim()) return res.json([]);
        res.json(JSON.parse(data));
    } catch (error) {
        console.error("Lỗi đọc file:", error);
        res.json([]); 
    }
});

// API: Gửi tin nhắn nhóm
app.post("/groupMessages", (req, res) => {
    const { name, text } = req.body;
    if (!name || !text) return res.status(400).json({ error: "Thiếu tên hoặc nội dung." });

    try {
        let messages = [];
        try {
            const fileContent = fs.readFileSync(GROUP_FILE, "utf8");
            messages = JSON.parse(fileContent);
        } catch (e) {
            // Nếu file lỗi JSON, khởi tạo lại mảng rỗng
            messages = [];
        }

        messages.push({ sender: name, text });
        fs.writeFileSync(GROUP_FILE, JSON.stringify(messages, null, 2));

        res.json({ success: true });
    } catch (error) {
        console.error("Lỗi lưu tin nhắn:", error);
        res.status(500).json({ error: "Lỗi server khi lưu tin nhắn" });
    }
});

// API: Chatbot AI (Cập nhật Model Gemini 1.5 Flash)
app.post("/bot", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Thiếu nội dung." });

    // Kiểm tra xem người dùng đã thay key chưa
    if (GEMINI_API_KEY === "API_KEY_GEMINI" || !GEMINI_API_KEY) {
        return res.json({ sender: "Bot", text: "Lỗi: Bạn chưa điền API Key vào file server.js!" });
    }

    let botReply = "Bot gặp lỗi khi xử lý.";

    try {
