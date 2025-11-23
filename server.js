const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const GROUP_FILE = "group.json";

// Lấy Key Hugging Face
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;

// --- ĐỔI SANG MODEL NHẸ HƠN VÀ ỔN ĐỊNH HƠN ---
const HF_MODEL = "HuggingFaceH4/zephyr-7b-beta"; 
// Link API
const API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

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

// --- HÀM GỌI HUGGING FACE (CÓ RETRY) ---
async function queryHuggingFace(text, retries = 5) {
    try {
        // Prompt được tối ưu cho Zephyr
        const prompt = `<|system|>\nBạn là trợ lý ảo hữu ích, trả lời ngắn gọn bằng tiếng Việt.</s>\n<|user|>\n${text}</s>\n<|assistant|>\n`;

        const response = await axios.post(
            API_URL,
            {
                inputs: prompt,
                parameters: {
                    max_new_tokens: 250,
                    return_full_text: false,
                    temperature: 0.7
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );
        return response.data[0].generated_text;

    } catch (error) {
        const errData = error.response?.data;
        // Nếu lỗi là "Model is loading" (Model đang khởi động)
        if (errData?.error?.includes("loading")) {
            if (retries > 0) {
                const waitTime = Math.ceil(errData.estimated_time || 10);
                console.log(`⏳ Model đang bật... Đợi ${waitTime} giây...`);
                // Chờ và gọi lại
                await new Promise(r => setTimeout(r, waitTime * 1000));
                return queryHuggingFace(text, retries - 1);
            }
        }
        throw error;
    }
}

// 3. API Chatbot AI
app.post("/bot", async (req, res) => {
    const { text } = req.body;
    console.log("User hỏi:", text);

    if (!HUGGING_FACE_API_KEY) {
        return res.json({ 
            sender: "Bot", 
            text: "LỖI CÀI ĐẶT: Bạn chưa thêm biến HUGGING_FACE_API_KEY vào Render." 
        });
    }

    try {
        const botReply = await queryHuggingFace(text);
        res.json({ sender: "Bot", text: botReply.trim() });

    } catch (err) {
        console.error("--- LỖI API ---");
        // In lỗi chi tiết ra log Render
        const errorDetails = err.response?.data || err.message;
        console.error(errorDetails);

        // --- QUAN TRỌNG: Trả về lỗi chi tiết cho User thấy để sửa ---
        let userMessage = "Lỗi kết nối.";
        
        if (err.response?.status === 401) {
            userMessage = "Lỗi 401: API Key không đúng hoặc không có quyền truy cập.";
        } else if (err.response?.status === 503) {
            userMessage = "Lỗi 503: Server Hugging Face đang quá tải. Hãy thử lại sau 1 phút.";
        } else if (typeof errorDetails === 'object') {
             userMessage = "Lỗi lạ: " + JSON.stringify(errorDetails);
        } else {
             userMessage = "Lỗi: " + errorDetails;
        }

        res.json({ 
            sender: "Bot", 
            text: `⚠️ ${userMessage}` 
        });
    }
});

app.use(express.static("."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy port ${PORT}`));
