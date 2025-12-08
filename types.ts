
export interface Scene {
  scene_number: number;
  script_description: string;
  veo_prompt: string;
  wishk_prompt: string; // New field for Wishk AI
}

export interface Script {
  story_summary: string;
  scenes: Scene[];
}

export type PromptType = 'default' | 'camera_lock';

export interface VideoGenerationOptions {
  idea: string;
  promptCount: number | string;
  videoStyle: string;
  aspectRatio: string;
  dialogueLanguage: string;
  promptType: PromptType;
}
