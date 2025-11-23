const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const GROUP_FILE = "group.json";

// Lấy Key Groq từ biến môi trường
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Cấu hình Model Groq (Dùng Llama 3 - Rất xịn)
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_NAME = "llama3-8b-8192"; 

// Tạo file group chat ảo
if (!fs.existsSync(GROUP_FILE)) {
    try { fs.writeFileSync(GROUP_FILE, "[]"); } catch (e) {}
}

// 1. API Lấy tin nhắn nhóm
app.get("/groupMessages", (req, res) => {
    try {
        if (!fs.existsSync(GROUP_FILE)) return res.json([]);
        const data = fs.readFileSync(GROUP_FILE, "utf8");
        res.json(data ? JSON.parse(data) : []);
    } catch (error) { res.json([]); }
});

// 2. API Gửi tin nhắn nhóm
app.post("/groupMessages", (req, res) => {
    const { name, text } = req.body;
    if (!name || !text) return res.status(400).json({ error: "Thiếu dữ liệu" });
    try {
        let messages = [];
        if (fs.existsSync(GROUP_FILE)) {
            try { messages = JSON.parse(fs.readFileSync(GROUP_FILE, "utf8")); } catch (e) {}
        }
        messages.push({ sender: name, text });
        if (messages.length > 50) messages = messages.slice(-50);
        fs.writeFileSync(GROUP_FILE, JSON.stringify(messages, null, 2));
        res.json({ success: true });
    } catch (error) { res.json({ success: false }); }
});

// 3. API Chatbot AI (Dùng Groq - Siêu nhanh)
app.post("/bot", async (req, res) => {
    const { text } = req.body;
    console.log("User hỏi:", text);

    if (!GROQ_API_KEY) {
        return res.json({ 
            sender: "Bot", 
            text: "Lỗi Server: Bạn chưa cài GROQ_API_KEY trên Render." 
        });
    }

    try {
        const response = await axios.post(
            GROQ_API_URL,
            {
                model: MODEL_NAME,
                messages: [
                    {
                        role: "system",
                        content: "Bạn là trợ lý ảo hữu ích, vui vẻ. Hãy trả lời câu hỏi bằng tiếng Việt ngắn gọn, súc tích."
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.7
            },
            {
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // Lấy câu trả lời từ Groq
        const botReply = response.data.choices[0]?.message?.content || "Bot đang suy nghĩ...";
        res.json({ sender: "Bot", text: botReply });

    } catch (err) {
        console.error("--- LỖI GROQ API ---");
        console.error(err.response?.data || err.message);

        // Xử lý thông báo lỗi dễ hiểu
        let msg = "Lỗi kết nối Groq.";
        if (err.response?.status === 401) msg = "Sai API Key Groq.";
        if (err.response?.status === 429) msg = "Bot đang quá tải (Rate Limit), hãy đợi vài giây.";

        res.json({ sender: "Bot", text: `⚠️ ${msg}` });
    }
});

app.use(express.static("."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy port ${PORT}`));
