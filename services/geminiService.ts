import { GoogleGenAI } from "@google/genai";
import { Script, VideoGenerationOptions, Scene } from '../types';

/**
 * Creates the GoogleGenAI client using the provided API key.
 */
function createAiClient(apiKey: string): GoogleGenAI {
    if (!apiKey) {
        throw new Error("Vui lòng nhập Google AI Studio API Key.");
    }
    return new GoogleGenAI({ apiKey: apiKey });
}

/**
 * Validates the provided API Key.
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
    const key = apiKey ? apiKey.trim() : "";
    if (!key.startsWith("AIza")) return false;

    try {
        const ai = new GoogleGenAI({ apiKey: key });
        // Use a minimal token request to check validity
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: "a" }] },
        });
        return !!response.text;
    } catch (e: any) {
        return false;
    }
}

// --- HELPER FUNCTIONS FOR DATA CLEANING ---

function cleanAttribute(text: string | undefined | null): string {
    if (!text) return "";
    let t = text.trim();
    if (['không có', 'none', 'n/a', 'null', '', 'unknown'].includes(t.toLowerCase())) return "";
    t = t.replace(/^[,.\s]+|[,.\s]+$/g, ""); 
    t = t.replace(/(\r\n|\n|\r)/gm, " "); 
    return t.trim();
}

function cleanForJson(text: string | undefined | null): string {
    if (!text) return "";
    return text.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, " ").trim();
}

function mapJsonToScenes(rawScenes: any[]): Scene[] {
    return rawScenes.map((item: any, index: number) => {
        // Time
        const timeStart = item.time?.start ?? 0;
        const timeEnd = item.time?.end ?? 5;
        const timeLine = `Thời lượng: ${timeStart}s - ${timeEnd}s`;

        // Continuity
        const continuity = cleanAttribute(item.continuity_reference);
        const continuityLine = continuity ? `Continuity: ${continuity}` : '';

        // Environment
        const location = cleanAttribute(item.environment?.location);
        const weather = cleanAttribute(item.environment?.weather);
        const sounds = Array.isArray(item.environment?.ambient_sound) 
            ? item.environment.ambient_sound.map(cleanAttribute).join(', ') 
            : cleanAttribute(item.environment?.ambient_sound);
        
        const envParts = [];
        if (location) envParts.push(`Địa điểm: ${location}`);
        if (weather) envParts.push(`Thời tiết: ${weather}`);
        if (sounds) envParts.push(`Âm thanh: ${sounds}`);
        const envLine = envParts.join(' | ');

        // Characters
        let charLine = '';
        if (item.characters && Array.isArray(item.characters)) {
             const chars = item.characters.map((c: any) => {
                 const name = cleanAttribute(c.name);
                 const app = cleanAttribute(c.appearance);
                 const outfit = cleanAttribute(c.outfit);
                 const emotion = cleanAttribute(c.emotion);
                 const action = cleanAttribute(c.actions?.body_movement);
                 
                 let desc = name;
                 if (app || outfit) desc += ` [${[app, outfit].filter(Boolean).join(', ')}]`;
                 if (emotion) desc += ` (Cảm xúc: ${emotion})`;
                 if (action) desc += ` -> Hành động: ${action}`;
                 return desc;
             }).join('; '); 
             if (chars) charLine = `Nhân vật: ${chars}`;
        }

        // Camera & Style
        const shotType = cleanAttribute(item.camera?.shot_type);
        const camMove = cleanAttribute(item.camera?.movement);
        const cameraLine = (shotType || camMove) ? `Camera: ${shotType} | ${camMove}` : '';

        const styleName = cleanAttribute(item.visual_style?.style);
        const lighting = cleanAttribute(item.visual_style?.lighting);
        const styleLine = (styleName || lighting) ? `Visual: ${styleName} | Light: ${lighting}` : '';

        // Dialogue
        const line = cleanAttribute(item.dialogue?.line);
        const lang = cleanAttribute(item.dialogue?.language);
        const dialogueLine = line ? `Thoại (${lang}): "${line}"` : 'Thoại: Không có';

        // Description for UI
        const description = [
            `Cảnh ${item.scene || index + 1} (${timeLine})`,
            continuityLine,
            envLine,
            charLine,
            cameraLine,
            styleLine,
            dialogueLine
        ].filter(Boolean).join(' | ');

        // Strict JSON Prompt for Veo
        const jsonPrompt = {
            scene: item.scene || index + 1,
            time: item.time || { start: 0, end: 5 },
            continuity_reference: cleanForJson(item.continuity_reference),
            environment: {
                location: cleanForJson(item.environment?.location),
                weather: cleanForJson(item.environment?.weather),
                ambient_sound: Array.isArray(item.environment?.ambient_sound) 
                    ? item.environment.ambient_sound.map(cleanForJson)
                    : []
            },
            characters: (item.characters || []).map((c: any) => ({
                name: cleanForJson(c.name),
                appearance: cleanForJson(c.appearance),
                outfit: cleanForJson(c.outfit),
                emotion: cleanForJson(c.emotion),
                actions: { body_movement: cleanForJson(c.actions?.body_movement) }
            })),
            camera: {
                shot_type: cleanForJson(item.camera?.shot_type),
                movement: cleanForJson(item.camera?.movement)
            },
            visual_style: {
                style: cleanForJson(item.visual_style?.style),
                lighting: cleanForJson(item.visual_style?.lighting)
            },
            dialogue: {
                line: cleanForJson(item.dialogue?.line),
                language: cleanForJson(item.dialogue?.language)
            }
        };

        let rawWishk = item.wishk_prompt || "";
        rawWishk = cleanForJson(rawWishk);

        return {
            scene_number: item.scene || index + 1,
            script_description: description,
            veo_prompt: JSON.stringify(jsonPrompt), 
            wishk_prompt: rawWishk 
        };
    });
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- CORE GENERATION LOGIC ---

async function generateBatch(
    ai: GoogleGenAI,
    options: VideoGenerationOptions,
    startIndex: number,
    count: number,
    previousContext: string | null,
    storySummary: string | null
): Promise<{ scenes: any[], summary: string }> {

    const isFirstBatch = startIndex === 1;

    let contextInstructions = "";
    if (isFirstBatch) {
        contextInstructions = `
        TASK: Start the story based on the user's IDEA.
        Generate scenes ${startIndex} to ${startIndex + count - 1}.
        Create a "story_summary" in Vietnamese.
        `;
    } else {
        contextInstructions = `
        TASK: Continue the story seamlessly.
        CONTEXT:
        - Story Summary: ${storySummary}
        - Previous Scene End State: ${previousContext}
        
        Generate scenes ${startIndex} to ${startIndex + count - 1}.
        `;
    }

    const systemPrompt = `
You are an elite Video Script & Prompt Engineer.
${contextInstructions}

RULES:
1. QUANTITY: OUTPUT EXACTLY ${count} SCENES in the "scenes" array.
2. LANGUAGE: All descriptive text MUST be in **VIETNAMESE**.
3. FORMAT: Strictly valid JSON.
4. NO LINE BREAKS IN 'wishk_prompt'.

USER INPUT:
- Idea: ${options.idea}
- Style: ${options.videoStyle}
- Dialogue: ${options.dialogueLanguage}

REQUIRED JSON STRUCTURE:
{
  "story_summary": "Summary in Vietnamese",
  "scenes": [
    {
      "scene": <number>,
      "time": { "start": 0, "end": 5 },
      "continuity_reference": "...",
      "environment": { "location": "...", "weather": "...", "ambient_sound": ["..."] },
      "characters": [
        { "name": "...", "appearance": "...", "outfit": "...", "emotion": "...", "actions": { "body_movement": "..." } }
      ],
      "camera": { "shot_type": "...", "movement": "..." },
      "visual_style": { "style": "${options.videoStyle}", "lighting": "..." },
      "dialogue": { "line": "...", "language": "..." },
      "wishk_prompt": "Vietnamese prompt. Single line. End with '${options.videoStyle}, cinematic, 8k'"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: systemPrompt }] },
        config: { responseMimeType: 'application/json' }
    });

    if (!response.text) throw new Error("No response from AI");
    const json = JSON.parse(response.text);

    return {
        scenes: json.scenes || [],
        summary: json.story_summary || ""
    };
}

/**
 * Smart Wrapper: Handles 429 Quota Exceeded by parsing the wait time
 */
async function generateBatchWithRetry(
    ai: GoogleGenAI,
    options: VideoGenerationOptions,
    startIndex: number,
    count: number,
    previousContext: string | null,
    storySummary: string | null,
    onProgress: (msg: string) => void
): Promise<{ scenes: any[], summary: string }> {
    const MAX_RETRIES = 10;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            return await generateBatch(ai, options, startIndex, count, previousContext, storySummary);
        } catch (error: any) {
            attempt++;
            
            // Collect all possible error details
            const errAny = error as any;
            const errorDetails = errAny.response ? JSON.stringify(errAny.response) : "";
            // Combine message, stringified error, and deep response to catch the code/message
            const errorString = `${errAny.message || ""} ${JSON.stringify(errAny)} ${errorDetails}`;
            
            const isQuota = errorString.includes('429') || errorString.includes('quota') || errorString.includes('RESOURCE_EXHAUSTED');
            const isOverloaded = errorString.includes('503') || errorString.includes('overloaded');

            if ((isQuota || isOverloaded) && attempt < MAX_RETRIES) {
                let waitTime = 6000; // Default fallback 6s

                // SMART RETRY: Extract "retry in X s" from error message
                const match = errorString.match(/retry in (\d+(\.\d+)?)s/i);
                
                if (match && match[1]) {
                    // Google is telling us exactly how long to wait.
                    // We add a healthy 3s buffer to be safe.
                    const googleWaitTime = parseFloat(match[1]);
                    waitTime = Math.ceil(googleWaitTime) * 1000 + 3000; 
                    
                    onProgress(`Quota API đã đầy. Google yêu cầu chờ ${Math.round(googleWaitTime)}s. Hệ thống sẽ tự động thử lại sau ${Math.round(waitTime/1000)}s...`);
                } else if (isQuota) {
                    // Quota exceeded but no time specified?
                    // Increasing backoff: 20s, 40s, 60s...
                    waitTime = 20000 * attempt; 
                    onProgress(`Đã chạm giới hạn Quota. Đang tạm dừng ${waitTime/1000}s để hồi phục... (Lần ${attempt})`);
                } else {
                     // 503 Overloaded
                     waitTime = 5000 * Math.pow(2, attempt - 1);
                     onProgress(`Server Google đang bận (503). Thử lại sau ${Math.round(waitTime/1000)}s...`);
                }

                await delay(waitTime);
                continue; // Retry logic
            }
            
            throw error;
        }
    }
    throw new Error("Không thể kết nối sau nhiều lần thử. Vui lòng kiểm tra Quota tài khoản Google của bạn.");
}

export async function generateScript(
    options: VideoGenerationOptions, 
    apiKey: string, 
    onProgress: (msg: string) => void
): Promise<Script> {
    const ai = createAiClient(apiKey);
    
    // STRATEGY: 
    // Batch Size 10 + Hard Delay 6s = Max 100 scenes/minute (theoretical) but practically much slower.
    // This keeps us safely under the 15-20 Requests Per Minute limit.
    const BATCH_SIZE = 10; 
    
    let targetCount = typeof options.promptCount === 'string' 
        ? parseInt(options.promptCount, 10) 
        : options.promptCount;

    if (isNaN(targetCount) || targetCount <= 0) targetCount = 5;

    let allRawScenes: any[] = [];
    let storySummary = "";
    let previousContext = "";

    const totalBatches = Math.ceil(targetCount / BATCH_SIZE);

    for (let batch = 0; batch < totalBatches; batch++) {
        const startIndex = (batch * BATCH_SIZE) + 1;
        const countForThisBatch = Math.min(BATCH_SIZE, targetCount - allRawScenes.length);

        onProgress(`Đang xử lý phần ${batch + 1}/${totalBatches} (Cảnh ${startIndex} - ${startIndex + countForThisBatch - 1})...`);

        try {
            const result = await generateBatchWithRetry(
                ai, 
                options, 
                startIndex, 
                countForThisBatch, 
                previousContext, 
                storySummary,
                onProgress
            );

            if (batch === 0) storySummary = result.summary;

            if (result.scenes && result.scenes.length > 0) {
                // Correct scene numbers
                const correctedScenes = result.scenes.map((s, idx) => ({
                    ...s,
                    scene: startIndex + idx
                }));
                allRawScenes = [...allRawScenes, ...correctedScenes];

                // Context for next batch
                const lastScene = correctedScenes[correctedScenes.length - 1];
                const charAction = lastScene.characters?.[0]?.actions?.body_movement || "";
                const location = lastScene.environment?.location || "";
                previousContext = `Scene ${lastScene.scene} ended at ${location}. Action: ${charAction}`;
                
                // --- HARD DELAY FOR STABILITY ---
                // Wait 6 seconds between batches to avoid "Burst" rate limiting.
                if (batch < totalBatches - 1) {
                    onProgress(`Đang nghỉ 6s để bảo vệ tài khoản Google...`);
                    await delay(6000); 
                }
            }
        } catch (err: any) {
            console.error(`Batch ${batch + 1} failed:`, err);
            throw new Error(`Lỗi ở phần ${batch + 1}: ${err.message}`);
        }
    }

    return {
        story_summary: storySummary,
        scenes: mapJsonToScenes(allRawScenes)
    };
}

export async function extendScript(
    lastScene: Scene,
    extensionIdea: string,
    count: number,
    originalOptions: VideoGenerationOptions,
    apiKey: string
): Promise<Scene[]> {
    const ai = createAiClient(apiKey);
    const startNum = lastScene.scene_number + 1;

    // Use a simpler prompt structure for extension
    const prompt = `
You are extending an existing video script. 
STRICT REQUIREMENT: Generate exactly ${count} NEW scenes.

PREVIOUS SCENE CONTEXT (${lastScene.scene_number}):
${lastScene.script_description}

NEW IDEA TO EXTEND:
${extensionIdea}

RULES:
1. QUANTITY: OUTPUT EXACTLY ${count} SCENES.
2. LANGUAGE: All descriptive text MUST be in **VIETNAMESE**.
3. CONTINUITY IS KING: Scene ${startNum} MUST start exactly where Scene ${lastScene.scene_number} ended.
4. FORMAT: JSON.

REQUIRED JSON STRUCTURE:
{
  "scenes": [
    {
      "scene": ${startNum},
      "time": { "start": 0, "end": 5 },
      "continuity_reference": "...",
      "environment": { ... },
      "characters": [ ... ],
      "camera": { ... },
      "visual_style": { "style": "${originalOptions.videoStyle}", "lighting": "..." },
      "dialogue": { ... },
      "wishk_prompt": "..."
    }
  ]
}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });

        if (!response.text) throw new Error("No response");
        const json = JSON.parse(response.text);
        const mapped = mapJsonToScenes(json.scenes || []);
        return mapped.map((s, i) => ({ ...s, scene_number: startNum + i }));
    } catch (error: any) {
        throw new Error("Extension failed: " + error.message);
    }
}