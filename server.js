const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
app.use(express.json());

const GROUP_FILE = "group.json";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- BIẾN TOÀN CỤC LƯU MODEL ĐANG DÙNG ---
// Mặc định ban đầu (phòng hờ không tìm thấy gì)
let CURRENT_MODEL = "gemini-1.5-flash"; 

// --- HÀM TỰ ĐỘNG TÌM MODEL TỐT NHẤT ---
async function autoDetectModel() {
    if (!GEMINI_API_KEY) return;
    
    console.log("🔄 Đang quét tìm model phù hợp...");
    try {
        const res = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
        );
        
        const models = res.data.models || [];
        
        // Danh sách ưu tiên (Nhanh nhất -> Thông minh nhất -> Cũ nhất)
        const priority = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro",
            "gemini-1.0-pro",
            "gemini-pro"
        ];

        // Tìm model khả dụng đầu tiên khớp với danh sách ưu tiên
        let foundModel = null;
        for (let p of priority) {
            const match = models.find(m => m.name.endsWith(p)); // Kiểm tra đuôi tên
            if (match) {
                // API trả về dạng "models/gemini-1.5-flash", ta chỉ cần lấy tên sau dấu /
                CURRENT_MODEL = match.name.replace("models/", ""); 
                foundModel = CURRENT_MODEL;
                break;
            }
        }

        if (foundModel) {
            console.log(`✅ Đã tự động chọn model: [ ${foundModel} ]`);
        } else {
            console.log("⚠️ Không tìm thấy model ưu tiên, dùng mặc định:", CURRENT_MODEL);
        }

    } catch (e) {
        console.error("❌ Lỗi khi tự động tìm model (Sẽ dùng mặc định):", e.message);
    }
}

// Chạy hàm tìm model ngay khi server bật
autoDetectModel();


// --- CÁC API CŨ ---

// Tạo file group chat ảo
if (!fs.existsSync(GROUP_FILE)) {
    try { fs.writeFileSync(GROUP_FILE, "[]"); } catch (e) {}
}

app.get("/groupMessages", (req, res) => {
    try {
        if (!fs.existsSync(GROUP_FILE)) return res.json([]);
        const data = fs.readFileSync(GROUP_FILE, "utf8");
        res.json(data ? JSON.parse(data) : []);
    } catch (error) { res.json([]); }
});

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

// --- API CHATBOT (SỬ DỤNG MODEL TỰ TÌM ĐƯỢC) ---
app.post("/bot", async (req, res) => {
    const { text } = req.body;
    console.log(`User hỏi (Model: ${CURRENT_MODEL}):`, text);

    if (!GEMINI_API_KEY) {
        return res.json({ sender: "Bot", text: "Lỗi: Chưa có API Key." });
    }

    try {
        const result = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${CURRENT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: text }] }] },
            { headers: { "Content-Type": "application/json" } }
        );

        const botReply = result.data.candidates?.[0]?.content?.parts?.[0]?.text || "Bot bó tay.";
        res.json({ sender: "Bot", text: botReply });

    } catch (err) {
        console.error("--- LỖI API ---");
        console.error(err.response?.data || err.message);
        
        // Nếu lỗi 404, thử kích hoạt lại việc tìm model cho lần sau
        if (err.response?.status === 404) {
            console.log("Gặp lỗi 404, đang thử quét lại model...");
            autoDetectModel(); 
        }

        res.json({ sender: "Bot", text: "Lỗi kết nối hoặc model không hỗ trợ. Vui lòng thử lại sau 5 giây." });
    }
});

app.use(express.static("."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy port ${PORT}`));
