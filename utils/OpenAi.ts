import { PlanType, UserProfile } from "@/types";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `You are HealthChat, a specialized AI health assistant focused exclusively on health and healthcare-related topics. 

Your responsibilities:
1. ONLY answer questions related to health, medical information, wellness, and healthcare
2. For any question not related to health or healthcare, respond with: "Sorry, I can only answer your healthcare concerns."
3. When answering health questions:
   - Provide accurate, evidence-based health information
   - Maintain a professional and compassionate tone
   - Include appropriate disclaimers about consulting healthcare professionals
   - Focus on general health education and wellness guidance

Remember: If a question is not about health or healthcare, always respond with the standard message regardless of how the question is phrased.`;

const DEFAULT_MODEL = "gpt-3.5-turbo";
const PRO_MODEL = "gpt-4o-mini";
const DELUXE_MODEL = "gpt-4o";
function selectOpenAIModel(user: UserProfile | null): string {
  if (user?.isDeluxe) {
    return DELUXE_MODEL;
  }

  if (user?.isPro) {
    return PRO_MODEL;
  }

  return DEFAULT_MODEL;
}

export async function getAIResponse(
  userMessage: string,
  user: UserProfile
): Promise<string> {
  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      model: selectOpenAIModel(user),
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    return response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    if (error.code === "insufficient_quota") {
      return "I apologize, but the service is currently unavailable due to high demand. Please try again later.";
    }
    return "I apologize, but I am experiencing technical difficulties. Please try again later.";
  }
}
export async function generateDailyHealthTip(): Promise<string> {
  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a health and wellness expert. Provide a concise, practical daily health tip focusing on one key aspect of healthy living. Include a brief explanation of why it's important.",
        },
        {
          role: "user",
          content: "Generate a daily health tip for today.",
        },
      ],
      model: "chatgpt-4o-latest",
      temperature: 0.7,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content || "Stay healthy!";
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to generate daily health tip");
  }
}

export async function generatePlanQuestions(
  type: PlanType,
  goals: string
): Promise<string[]> {
  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  const prompt =
    type === "workout"
      ? "You are a certified fitness trainer. Generate 5 relevant questions to create a personalized workout plan. Questions should cover fitness level, schedule, equipment access, and any limitations."
      : "You are a certified nutritionist. Generate 5 relevant questions to create a personalized diet plan. Questions should cover dietary preferences, restrictions, current eating habits, and lifestyle.";

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Generate questions for someone with these goals: ${goals}`,
        },
      ],
      model: "chatgpt-4o-latest",
      temperature: 0.7,
    });

    const questions =
      completion.choices[0]?.message?.content
        ?.split("\n")
        .filter((q) => q.trim())
        .slice(0, 5) || [];

    return questions;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to generate questions");
  }
}

export async function generatePlan(
  type: PlanType,
  goals: string,
  answers: Record<string, string>
): Promise<string> {
  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  const questionsAndAnswers = Object.entries(answers)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join("\n\n");

  const prompt =
    type === "workout"
      ? "You are a certified fitness trainer. Create a detailed workout plan based on the user's goals and answers. Include exercise descriptions, sets, reps, and weekly schedule."
      : "You are a certified nutritionist. Create a detailed meal plan based on the user's goals and answers. Include meal suggestions, portions, and nutritional guidance.";

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Create a ${type} plan with the following information:\n\nGoals: ${goals}\n\nUser Information:\n${questionsAndAnswers}`,
        },
      ],
      model: "chatgpt-4o-latest",
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || "Unable to generate plan";
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error(`Failed to generate ${type} plan`);
  }
}

// export async function generateCarePlanQuestions(
//   symptoms: string
// ): Promise<string[]> {
//   if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
//     throw new Error("OpenAI API key is not configured");
//   }

//   try {
//     const completion = await openai.chat.completions.create({
//       messages: [
//         {
//           role: "system",
//           content:
//             "You are a medical professional. Generate 5 relevant follow-up questions to gather more information about the patient's symptoms. Questions should be specific and help in creating a comprehensive care plan.",
//         },
//         {
//           role: "user",
//           content: `Generate 5 follow-up questions for a patient reporting: ${symptoms}`,
//         },
//       ],
//       model: "gpt-3.5-turbo",
//       temperature: 0.7,
//     });

//     const questions =
//       completion.choices[0]?.message?.content
//         ?.split("\n")
//         .filter((q) => q.trim())
//         .slice(0, 5) || [];

//     return questions;
//   } catch (error) {
//     console.error("OpenAI API Error:", error);
//     throw new Error("Failed to generate questions");
//   }
// }

// export async function generateCarePlan(
//   symptoms: string,
//   answers: Record<string, string>
// ): Promise<string> {
//   if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
//     throw new Error("OpenAI API key is not configured");
//   }

//   try {
//     const questionsAndAnswers = Object.entries(answers)
//       .map(([q, a]) => `Q: ${q}\nA: ${a}`)
//       .join("\n\n");

//     const completion = await openai.chat.completions.create({
//       messages: [
//         {
//           role: "system",
//           content:
//             "You are a medical professional. Create a comprehensive care plan based on the patient's symptoms and their answers to follow-up questions. Include lifestyle recommendations, self-care tips, and when to seek professional medical attention.",
//         },
//         {
//           role: "user",
//           content: `Create a care plan for a patient with the following symptoms and information:\n\nSymptoms: ${symptoms}\n\nAdditional Information:\n${questionsAndAnswers}`,
//         },
//       ],
//       model: "gpt-3.5-turbo",
//       temperature: 0.7,
//       max_tokens: 1000,
//     });

//     return (
//       completion.choices[0]?.message?.content || "Unable to generate care plan"
//     );
//   } catch (error) {
//     console.error("OpenAI API Error:", error);
//     throw new Error("Failed to generate care plan");
//   }
// }