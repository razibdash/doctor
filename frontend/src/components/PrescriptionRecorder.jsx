// PrescriptionRecorder.jsx
import React, { useState, useRef } from "react";

export default function PrescriptionRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [loading, setLoading] = useState(false);
  const [prescription, setPrescription] = useState({
    patientName: "",
    patientAge: "",
    patientWeight: "",
    diagnosis: "",
    medications: [], // {name, dose, frequency, duration, notes}
    instructions: "",
  });

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  async function startRecording() {
    setTranscription("");
    setPrescription({
      patientName: "",
      patientAge: "",
      patientWeight: "",
      diagnosis: "",
      medications: [],
      instructions: "",
    });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      setAudioUrl(URL.createObjectURL(blob));
      await uploadAudio(blob);
    });

    mediaRecorder.start();
    setRecording(true);
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function uploadAudio(blob) {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "speech.webm");

      const res = await fetch("http://localhost:3000/api/transcribe", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Transcription failed");
      }

      const data = await res.json();
      // data: { transcription: "...", prescription: {...} }
      setTranscription(data.transcription || "");
      if (data.prescription) setPrescription(data.prescription);
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateMedication(idx, field, value) {
    const meds = [...prescription.medications];
    meds[idx] = { ...meds[idx], [field]: value };
    setPrescription({ ...prescription, medications: meds });
  }

  function addMedication() {
    setPrescription({
      ...prescription,
      medications: [
        ...prescription.medications,
        { name: "", dose: "", frequency: "", duration: "", notes: "" },
      ],
    });
  }
  function removeMedication(idx) {
    const meds = [...prescription.medications];
    meds.splice(idx, 1);
    setPrescription({ ...prescription, medications: meds });
  }
  console.log(transcription, prescription);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">
        Voice → Auto-fill Prescription
      </h2>

      <div className="mb-4">
        {!recording ? (
          <button
            onClick={startRecording}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Stop Recording
          </button>
        )}
        <span className="ml-4 text-sm text-gray-600">
          {recording ? "Recording..." : ""}
        </span>
      </div>

      {audioUrl && (
        <div className="mb-4">
          <audio controls src={audioUrl} />
        </div>
      )}

      {loading && (
        <div className="mb-4 text-sm text-blue-600">
          Processing... please wait.
        </div>
      )}

      {transcription && (
        <div className="mb-4 p-4 bg-black-50 text-stone-200 rounded border">
          <h3 className="font-medium mb-2">Transcription</h3>
          <p className="text-sm">{transcription}</p>
        </div>
      )}

      <form className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={prescription.patientName}
            onChange={(e) =>
              setPrescription({ ...prescription, patientName: e.target.value })
            }
            className="p-2 border rounded"
            placeholder="Patient name"
          />
          <input
            value={prescription.patientAge}
            onChange={(e) =>
              setPrescription({ ...prescription, patientAge: e.target.value })
            }
            className="p-2 border rounded"
            placeholder="Age"
          />
          <input
            value={prescription.patientWeight}
            onChange={(e) =>
              setPrescription({
                ...prescription,
                patientWeight: e.target.value,
              })
            }
            className="p-2 border rounded"
            placeholder="Weight (kg)"
          />
        </div>

        <div>
          <textarea
            value={prescription.diagnosis}
            onChange={(e) =>
              setPrescription({ ...prescription, diagnosis: e.target.value })
            }
            className="w-full p-2 border rounded"
            placeholder="Diagnosis"
            rows="2"
          />
        </div>

        <div>
          <h4 className="font-medium mb-2">Medications</h4>
          {prescription.medications.map((med, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-2">
              <input
                value={med.name}
                onChange={(e) => updateMedication(i, "name", e.target.value)}
                className="p-2 border rounded"
                placeholder="Name"
              />
              <input
                value={med.dose}
                onChange={(e) => updateMedication(i, "dose", e.target.value)}
                className="p-2 border rounded"
                placeholder="Dose (e.g., 500 mg)"
              />
              <input
                value={med.frequency}
                onChange={(e) =>
                  updateMedication(i, "frequency", e.target.value)
                }
                className="p-2 border rounded"
                placeholder="Frequency (e.g., twice daily)"
              />
              <input
                value={med.duration}
                onChange={(e) =>
                  updateMedication(i, "duration", e.target.value)
                }
                className="p-2 border rounded"
                placeholder="Duration (e.g., 5 days)"
              />
              <input
                value={med.notes}
                onChange={(e) => updateMedication(i, "notes", e.target.value)}
                className="p-2 border rounded"
                placeholder="Notes"
              />
              <button
                type="button"
                onClick={() => removeMedication(i)}
                className="px-2 py-1 bg-red-600 text-white rounded"
              >
                Remove
              </button>
            </div>
          ))}

          <div>
            <button
              type="button"
              onClick={addMedication}
              className="px-3 py-1 bg-blue-600 text-stone-200 shadow cursor-pointer rounded"
            >
              Add medication
            </button>
          </div>
        </div>

        <div>
          <textarea
            value={prescription.instructions}
            onChange={(e) =>
              setPrescription({ ...prescription, instructions: e.target.value })
            }
            className="w-full p-2 border rounded"
            placeholder="Patient instructions"
            rows="3"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Save Prescription
          </button>
          <button type="button" className="px-4 py-2 border rounded">
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
