const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const Groq = require("groq-sdk");
const cors = require("cors");


dotenv.config();

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use(cors());
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // keep .m4a, .mp3, .webm etc.
    cb(null, Date.now() + ext);
  }
});

// only allow supported audio formats
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [
      ".flac", ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a",
      ".ogg", ".opus", ".wav", ".webm"
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Upload audio only."));
    }
  }
});



const systemPrompt = `
You are a highly accurate medical scribe AI. Your task is to listen to or read the doctor's voice transcription and extract all relevant prescription information into a structured JSON format.
The JSON must include the following fields:
- patientName: string 
- patientAge: string 
- patientWeight: string 
- diagnosis: string 
- medications: list of objects with:
    - name: string
    - dose: string (e.g., "500 mg")
    - frequency: string (e.g., "twice daily")
    - duration: string (e.g., "5 days")
    - notes: string (optional)
- instructions: string (general instructions, can be empty)

Always respond in **valid JSON only**, without additional text, explanations, or commentary. If any field is missing in the transcription, leave it as an empty string or empty array.
Be precise, consistent, and professional.
`



// 🎯 Main API route
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio uploaded" });
    }

    const audioPath = path.resolve(req.file.path);

    // 1️⃣ Transcribe audio with Groq Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-large-v3",
      prompt: systemPrompt,
    });

    const text = transcription.text;
            const prompt = `
        You are a medical scribe assistant. Extract a prescription from the doctor's spoken note below.generate a prescription in valid JSON format.describe the prescription in a clear and concise manner.you expect the doctor to provide all necessary details for a complete prescription.suggest medications,dose,frequency if not mentioned explicitly based on the diagnosis provided.
        Return ONLY valid JSON matching this schema:
        {
        "patientName": "string ",
        "patientAge": "string ",
        "patientWeight": "string ",
        "diagnosis": "string ",
        "medications": [
            {
            "name": "string",
            "dose": "string (e.g. 500 mg)",
            "frequency": "string (e.g. twice daily)",
            "duration": "string (e.g. 5 days)",
            "notes": "string (optional)"
            }
        ],
        "instructions": "string (general instructions)"
        }

        Doctor note:
        \"\"\"${text}\"\"\"
        `;

    // 2️⃣ Use chat model to convert into structured prescription
    const chatResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" } // ✅ Correct for Groq
    });

    const prescription = JSON.parse(chatResponse.choices[0].message.content);
    console.log("✅ Prescription:", prescription);

    // cleanup uploaded file
    fs.unlinkSync(audioPath);

    res.json({
      transcription: text,
      prescription
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(3000, () => console.log("🚀 Server running at http://localhost:3000"));
