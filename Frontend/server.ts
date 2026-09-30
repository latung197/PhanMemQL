import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API endpoint for AI business consultant analysis
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "Chưa cấu hình GEMINI_API_KEY trong file .env",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    const { systemCommand, erpData, userQuestion } = req.body;

    const dataContextStr = erpData ? JSON.stringify(erpData, null, 2) : "Không có dữ liệu ERP hiện tại.";

    const prompt = `
Dữ liệu ERP hiện tại của hệ thống doanh nghiệp:
${dataContextStr}

Yêu cầu/Câu hỏi của người dùng:
${userQuestion}
`;

    const systemInstruction = systemCommand || `Bạn là Trợ lý phân tích kinh doanh AI và chuyên gia tư vấn ERP tài ba tích hợp trong phần mềm S-ERP.
Nhiệm vụ của bạn là:
1. Trả lời các câu hỏi về dữ liệu kinh doanh hiện tại của hệ thống (Kho hàng, Doanh thu, Nhân sự, Khách hàng) bằng tiếng Việt rõ ràng, mạch lạc, trực quan.
2. Đọc hiểu sâu sắc các con số: phát hiện xu hướng bán hàng, cảnh báo sản phẩm sắp hết hàng, phân tích phòng ban nhân sự hoạt động tích cực hay chi phí mất cân đối.
3. Đưa ra các gợi ý và kế hoạch hành động cụ thể, thực tế để tăng trưởng doanh thu hoặc kiểm soát chi phí tốt hơn.
Hãy sử dụng định dạng Markdown đẹp mắt, có tiêu đề rành mạch, in đậm thông số quan trọng, và vẽ bảng hoặc biểu diễn có chiều sâu nếu cần thiết.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    res.json({ success: true, text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ success: false, error: error.message || "Lỗi xử lý trợ lý AI" });
  }
});

// Setup frontend serving
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupFrontend().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ERP Enterprise Server] running on http://0.0.0.0:${PORT}`);
  });
});
