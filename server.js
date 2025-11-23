const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const GROUP_FILE = "group.json";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

// 3. API Chatbot AI (CƠ CHẾ THỬ NHIỀU MODEL)
app.post("/bot", async (req, res) => {
    const { text } = req.body;
    console.log("User hỏi:", text);

    if (!GEMINI_API_KEY) {
        return res.json({ sender: "Bot", text: "Lỗi Server: Chưa cài API Key." });
    }

    // Danh sách model để thử lần lượt
    const modelsToTry = [
        "gemini-1.5-flash",       // Ưu tiên 1: Nhanh, mới
        "gemini-1.5-pro",         // Ưu tiên 2: Thông minh
        "gemini-1.0-pro",         // Ưu tiên 3: Bản ổn định cũ
        "gemini-pro"              // Ưu tiên 4: Tên gốc (hiếm khi chạy được ở bản mới nhưng cứ thử)
    ];

    let botReply = null;
    let errorLog = "";

    // Vòng lặp thử từng model
    for (const model of modelsToTry) {
        try {
            console.log(`🔄 Đang thử model: ${model}...`);
            const result = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
                { contents: [{ parts: [{ text: text }] }] },
                { headers: { "Content-Type": "application/json" } }
            );

            // Nếu chạy đến đây tức là thành công!
            botReply = result.data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log(`✅ Thành công với model: ${model}`);
            break; // Thoát vòng lặp ngay

        } catch (err) {
            console.log(`❌ Model ${model} thất bại (Lỗi ${err.response?.status || 'Unknown'})`);
            errorLog = err.response?.data?.error?.message || err.message;
            // Tiếp tục vòng lặp để thử model tiếp theo...
        }
    }

    // Kết quả cuối cùng
    if (botReply) {
        res.json({ sender: "Bot", text: botReply });
    } else {
        console.error("--- TẤT CẢ MODEL ĐỀU THẤT BẠI ---");
        console.error("Lỗi cuối cùng:", errorLog);
        res.json({ 
            sender: "Bot", 
            text: "Bot đang bị lỗi kết nối với Google (Hết lượt dùng hoặc sai Key). Hãy kiểm tra lại API Key của bạn." 
        });
    }
});

app.use(express.static("."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy port ${PORT}`));
