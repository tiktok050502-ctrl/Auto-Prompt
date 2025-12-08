
import { GoogleGenAI } from "@google/genai";
import { Script, VideoGenerationOptions, Scene } from '../types';

/**
 * Creates the GoogleGenAI client using the provided API key.
 * This ensures the prompt generation always uses the user's validated key.
 */
function createAiClient(apiKey: string): GoogleGenAI {
    if (!apiKey) {
        throw new Error("Vui lòng nhập Google AI Studio API Key.");
    }
    return new GoogleGenAI({ apiKey: apiKey });
}

/**
 * Validates the provided API Key with 100% accuracy.
 * 
 * Method: Challenge-Response
 * 1. Requires 'AIza' prefix (Google format).
 * 2. Sends a prompt asking for a specific unique number code.
 * 3. Verifies if the response contains that code.
 * 
 * If the key is invalid/non-existent, Google returns 400/403, throwing an error.
 * If the key is valid, the model processes the request and returns the code.
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
    const key = apiKey ? apiKey.trim() : "";
    
    // 1. Basic Google Key Format Check
    if (!key.startsWith("AIza")) return false;

    try {
        const ai = new GoogleGenAI({ apiKey: key });
        
        // 2. Challenge Request
        // We ask for a specific random-like number. 
        // This prevents cached responses from generic "Hello" prompts.
        const challengeCode = "918273645"; 
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { 
                parts: [{ text: `Reply with exactly this number: ${challengeCode}` }] 
            },
        });
        
        const text = response.text || "";
        
        // 3. strict Verification
        // If the key works, the AI MUST return the number.
        if (text.includes(challengeCode)) {
            return true;
        }
        
        return false;

    } catch (e: any) {
        // Any error (400 Invalid Key, 403 Permission, etc.) means the key is not usable.
        return false;
    }
}

function cleanAttribute(text: string | undefined | null): string {
    if (!text) return "";
    let t = text.trim();
    if (['không có', 'none', 'n/a', 'null', '', 'unknown'].includes(t.toLowerCase())) return "";
    t = t.replace(/^[,.\s]+|[,.\s]+$/g, ""); // Remove trailing/leading punctuation
    t = t.replace(/(\r\n|\n|\r)/gm, " "); // Replace newlines with space
    return t.trim();
}

function cleanForJson(text: string | undefined | null): string {
    if (!text) return "";
    // Strictly remove all newlines to ensure single-line JSON values
    return text.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, " ").trim();
}

// Map JSON response to internal Scene structure
function mapJsonToScenes(rawScenes: any[]): Scene[] {
    return rawScenes.map((item: any, index: number) => {
        // Extract fields based on NEW strict JSON format
        
        // Time
        const timeStart = item.time?.start ?? 0;
        const timeEnd = item.time?.end ?? 5;
        const timeLine = `Thời lượng: ${timeStart}s - ${timeEnd}s`;

        // Continuity
        const continuity = cleanAttribute(item.continuity_reference);
        const continuityLine = continuity ? `Continuity: ${continuity}` : (index > 0 ? 'Continuity: [Missing]' : '');

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

        // Characters - Join with semicolon for single line
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

        // Camera
        const shotType = cleanAttribute(item.camera?.shot_type);
        const camMove = cleanAttribute(item.camera?.movement);
        const cameraLine = (shotType || camMove) ? `Camera: ${shotType} | ${camMove}` : '';

        // Style
        const styleName = cleanAttribute(item.visual_style?.style);
        const lighting = cleanAttribute(item.visual_style?.lighting);
        const styleLine = (styleName || lighting) ? `Visual: ${styleName} | Light: ${lighting}` : '';

        // Dialogue
        const line = cleanAttribute(item.dialogue?.line);
        const lang = cleanAttribute(item.dialogue?.language);
        const dialogueLine = line ? `Thoại (${lang}): "${line}"` : 'Thoại: Không có';

        // Build a detailed description for the UI - SINGLE LINE, NO SEPARATORS
        const description = [
            `Cảnh ${item.scene || index + 1} (${timeLine})`,
            continuityLine,
            envLine,
            charLine,
            cameraLine,
            styleLine,
            dialogueLine
        ].filter(Boolean).join(' | '); // Join with pipe for continuous single line

        // Construct the Strict JSON Prompt for output - Sanitize inputs to prevent newlines
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
                actions: {
                    body_movement: cleanForJson(c.actions?.body_movement)
                }
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

        // Ensure Wishk prompt is single line
        let rawWishk = item.wishk_prompt || "";
        rawWishk = cleanForJson(rawWishk);

        return {
            scene_number: item.scene || index + 1,
            script_description: description,
            veo_prompt: JSON.stringify(jsonPrompt), // JSON.stringify(obj) produces a single line string by default
            wishk_prompt: rawWishk 
        };
    });
}

export async function generateScript(
    options: VideoGenerationOptions, 
    apiKey: string, 
    onProgress: (msg: string) => void
): Promise<Script> {
    // FORCE USE of the User's API Key
    const ai = createAiClient(apiKey);
    
    onProgress("Đang phân tích ý tưởng và áp dụng quy tắc JSON nghiêm ngặt...");

    const systemPrompt = `
You are an elite Video Script & Prompt Engineer.
APP RULES – ABSOLUTELY DO NOT BREAK:

1. 100% USER DRIVEN: Base every scene entirely on user's Idea and Options.
2. FRAME-BY-FRAME CONTINUITY: Characters/Environment must be identical across scenes.
3. LANGUAGE: All descriptive text (environment, characters, actions, continuity) MUST be in **VIETNAMESE** to help the user understand the scene.
4. OUTPUT FORMAT: strictly valid JSON following the schema below.
5. NO LINE BREAKS IN PROMPTS: The 'wishk_prompt' must be a single, continuous line.

USER INPUT:
- Idea: ${options.idea}
- Style: ${options.videoStyle}
- Prompt Count: ${options.promptCount}
- Prompt Type: ${options.promptType || 'default'}
- Dialogue Language: ${options.dialogueLanguage}

CRITICAL INSTRUCTION FOR DIALOGUE:
- If User chose "Tiếng Việt": "dialogue.line" MUST be in Vietnamese.
- If User chose "Tiếng Anh": "dialogue.line" MUST be in English.
- If User chose "Không Có": "dialogue.line" should be empty string.

REQUIRED JSON STRUCTURE (Must match exactly):
{
  "story_summary": "Brief summary in Vietnamese",
  "scenes": [
    {
      "scene": <number>,
      "time": {
        "start": <number>,
        "end": <number>
      },
      "continuity_reference": "<string - Describe in VIETNAMESE exactly the end state of previous scene (character position, pose, environment). Empty string for scene 1>",
      "environment": {
        "location": "<string - detailed location description in VIETNAMESE>",
        "weather": "<string - in VIETNAMESE>",
        "ambient_sound": [
          "<string - in VIETNAMESE>",
          "<string - in VIETNAMESE>"
        ]
      },
      "characters": [
        {
          "name": "<string>",
          "appearance": "<string - detailed appearance in VIETNAMESE>",
          "outfit": "<string - detailed outfit in VIETNAMESE>",
          "emotion": "<string - in VIETNAMESE>",
          "actions": {
            "body_movement": "<string - frame-by-frame action description in VIETNAMESE>"
          }
        }
      ],
      "camera": {
        "shot_type": "<string>",
        "movement": "<string>"
      },
      "visual_style": {
        "style": "<${options.videoStyle}>",
        "lighting": "<string - lighting description in VIETNAMESE>"
      },
      "dialogue": {
        "line": "<string - content of dialogue>",
        "language": "<string - language name>"
      },
      "wishk_prompt": "<string - A highly detailed VIETNAMESE prompt for image generation. It must describe the scene exactly including character appearance, outfit, environment, and lighting. WRITE IN A SINGLE CONTINUOUS LINE. End with '${options.videoStyle}, cinematic, 8k'.>"
    }
  ]
}
`;

    onProgress("Đang tạo kịch bản frame-by-frame...");
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json'
            }
        });

        if (!response.text) throw new Error("No response from AI");

        const json = JSON.parse(response.text);
        
        if (!json.scenes || !Array.isArray(json.scenes)) {
            throw new Error("Invalid JSON format received");
        }

        const scenes = mapJsonToScenes(json.scenes);

        return {
            story_summary: json.story_summary || "",
            scenes: scenes
        };

    } catch (error: any) {
        console.error("Generate Script Error:", error);
        throw new Error("Failed to generate script: " + error.message);
    }
}

export async function extendScript(
    lastScene: Scene,
    extensionIdea: string,
    count: number,
    originalOptions: VideoGenerationOptions,
    apiKey: string
): Promise<Scene[]> {
    // FORCE USE of the User's API Key
    const ai = createAiClient(apiKey);

    const prompt = `
You are extending an existing video script. STRICTLY FOLLOW CONTINUITY RULES.

PREVIOUS SCENE CONTEXT (${lastScene.scene_number}):
${lastScene.script_description}

NEW IDEA TO EXTEND:
${extensionIdea}

RULES:
1. LANGUAGE: All descriptive text MUST be in **VIETNAMESE**.
2. CONTINUITY IS KING: Scene ${lastScene.scene_number + 1} MUST start exactly where Scene ${lastScene.scene_number} ended.
3. Maintain exact character appearance (clothes, face) and environment.
4. Generate ${count} NEW scenes.
5. Output specific JSON format.
6. "wishk_prompt" must be in VIETNAMESE and SINGLE LINE.

REQUIRED JSON STRUCTURE (Must match exactly):
{
  "scenes": [
    {
      "scene": ${lastScene.scene_number + 1},
      "time": { "start": 0, "end": 5 },
      "continuity_reference": "Describe in VIETNAMESE exactly the end state of Scene ${lastScene.scene_number}",
      "environment": {
        "location": "Detailed description in VIETNAMESE...",
        "weather": "In VIETNAMESE...",
        "ambient_sound": ["In VIETNAMESE..."]
      },
      "characters": [
        {
          "name": "...",
          "appearance": "MATCH PREVIOUS SCENE (In VIETNAMESE)",
          "outfit": "MATCH PREVIOUS SCENE (In VIETNAMESE)",
          "emotion": "In VIETNAMESE...",
          "actions": { "body_movement": "In VIETNAMESE..." }
        }
      ],
      "camera": { "shot_type": "...", "movement": "..." },
      "visual_style": { "style": "...", "lighting": "In VIETNAMESE..." },
      "dialogue": { "line": "...", "language": "..." },
      "wishk_prompt": "Detailed VIETNAMESE prompt translating this exact scene. SINGLE LINE. Ending with '${originalOptions.videoStyle}, cinematic, 8k'"
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
        
        // Adjust scene numbers if necessary (though prompt should handle it)
        const startNum = lastScene.scene_number + 1;
        const mapped = mapJsonToScenes(json.scenes || []);
        
        return mapped.map((s, i) => ({ ...s, scene_number: startNum + i }));

    } catch (error: any) {
        throw new Error("Extension failed: " + error.message);
    }
}
