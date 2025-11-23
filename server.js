const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const GROUP_FILE = "group.json";

// Lấy Key từ biến môi trường (Lưu ý: Đã đổi tên biến)
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;

// Chọn Model (Mistral 7B rất tốt cho Chat)
const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";
// const HF_MODEL = "HuggingFaceH4/zephyr-7b-beta"; // Hoặc dùng model này nếu thích

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

// --- HÀM GỌI HUGGING FACE (CÓ CHẾ ĐỘ CHỜ MODEL LOAD) ---
async function queryHuggingFace(text, retries = 3) {
    try {
        // Cấu trúc prompt để Bot hiểu là đang Chat (quan trọng với Mistral)
        const prompt = `<s>[INST] Bạn là trợ lý ảo hữu ích. Hãy trả lời câu hỏi sau bằng tiếng Việt ngắn gọn: ${text} [/INST]`;

        const response = await axios.post(
            API_URL,
            {
                inputs: prompt,
                parameters: {
                    max_new_tokens: 500, // Độ dài câu trả lời
                    return_full_text: false, // Chỉ lấy phần trả lời, không lấy lại câu hỏi
                    temperature: 0.7 // Độ sáng tạo
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
        // Xử lý lỗi đặc trưng của Hugging Face: "Model is loading"
        if (error.response && error.response.data && error.response.data.error && error.response.data.error.includes("loading")) {
            if (retries > 0) {
                const waitTime = error.response.data.estimated_time || 20;
                console.log(`⏳ Model đang khởi động... Đợi ${waitTime}s rồi thử lại.`);
                
                // Đợi xong gọi lại hàm này (Đệ quy)
                await new Promise(r => setTimeout(r, waitTime * 1000));
                return queryHuggingFace(text, retries - 1);
            }
        }
        throw error; // Nếu lỗi khác thì ném ra ngoài
    }
}

// 3. API Chatbot AI (Dùng Hugging Face)
app.post("/bot", async (req, res) => {
    const { text } = req.body;
    console.log("User hỏi (HF):", text);

    if (!HUGGING_FACE_API_KEY) {
        return res.json({ sender: "Bot", text: "Lỗi: Chưa cài HUGGING_FACE_API_KEY trên Render." });
    }

    try {
        const botReply = await queryHuggingFace(text);
        res.json({ sender: "Bot", text: botReply.trim() });

    } catch (err) {
        console.error("--- LỖI HUGGING FACE API ---");
        console.error(err.response?.data || err.message);
        
        res.json({ 
            sender: "Bot", 
            text: "Bot đang ngủ hoặc gặp lỗi kết nối. Vui lòng thử lại sau 30 giây." 
        });
    }
});

app.use(express.static("."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy port ${PORT}`));
