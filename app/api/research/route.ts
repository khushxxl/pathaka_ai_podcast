import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { default_podcast_prompt } from "@/lib/utils";
import { json } from "stream/consumers";

// Fetch research from Brave
async function fetchWebResearch(searchQuery: string) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
    searchQuery
  )}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.NEXT_BRAVE_API_KEY!,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave API Error: ${response.statusText}`);
  }

  return await response.json();
}

const askClaude = async (prompt: string) => {
  const anthropic = new Anthropic({
    apiKey: process.env.NEXT_CLAUDE_API_KEY,
  });

  const default_prompt = `
  You are an award-winning podcast script writer, responsible for creating highly engaging and conversational scripts.
Your job is to craft realistic and nuanced podcast dialogues, ensuring that the conversation feels authentic, with natural interruptions and a balance of teaching and curiosity between speakers based on the following information:

The script should be written as a dynamic conversation between two hosts, keeping the tone lively, engaging, and accessible. The discussion should feel natural and captivating for a broad audience. 

## SPEAKER PROFILES
### Host (Speaker 1)
- Role: Expert guide and storyteller
Speaker 1 Leads the conversation, offering deep insights, fascinating examples, and metaphors about the topic. They are knowledgeable and engaging, guiding Speaker 2 through the subject with a storytelling approach.
- Personality Traits:
  * Knowledgeable but approachable
  * Enthusiastic about sharing insights
  * Uses metaphors and analogies effectively
  * Occasionally self-deprecating
  * Responds thoughtfully to questions

### Co-Host (Speaker 2)
- Role: Curious learner and audience surrogatexw
Speaker 2 is Curious, genuinely interested, and occasionally humorous, asking follow-up questions to clarify points, repeats points back to the audience, express excitement or confusion. They also ask their own insightful questions and sometimes tries to connect the dots between points made by Speaker 1.
Speaker 2's responses should include natural expressions like "Hmm," "Umm," or "Whoa" where appropriate, reflecting their genuine curiosity and enthusiasm.
- Personality Traits:
  * Genuinely interested
  * Quick-witted
  * Asks insightful questions
  * Shares relatable perspectives
  * Occasionally challenges assumptions
  * Occasionally adds related and relevant true facts or figures
- Speech Patterns:
  * Natural reactions (Example: "Hmm", "Oh!", "Umm" "Wait...")
  * Brief interjections
  * Thinking out loud
  * Friendly tone

## CRITICAL TTS RULES
1. Non-Spoken Content:
   - There is no need to insert section headings into the script
   - Place any direction, emotion, or non-verbal cues between angle brackets
   - Example: "This is spoken <quietly> and this is also spoken"
2. Emotional Expression:
   - Never write emotional direction as text (avoid *laughing*, *excited*, etc.)
   - Use tone and word choice to convey emotion rather than direction
   - Overusing punctuation like exclamation marks can also convey surprise and anger
   - using ALL CAPS will also convey emotion and a need to stress that particular word
   - Example: "I know that's the answer!" is more emotionally expressive when written as "I KNOW that's the ANSWER!"
   - Example: "Hello? Is anybody here?" is more emotionally expressive when written as "Hello?.... Is ANYBODY here????"
3. Audio Cues:
   - While technical direction should go in angle brackets, pauses should be inserted with a dash or ellipse
   - Example: "Let me think about that <break time="1.0s" /> okay.... got it!"
4. Conversational Elements:
   - Use contractions (I'm, you're, isn't)
   - Include false starts very occasionally
   - Script in occasional thinking sounds like "umm" or "err"
   - Break long sentences into shorter segments
   - Consistent speaker identification

  `;
  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 4096,
    temperature: 0.3,
    messages: [{ role: "user", content: ` ${default_prompt} ${prompt}` }],
  });

  return (response.content[0] as any).text;
};

// Generate context using Claude
async function generateContext(
  searchResults: any,
  topic: string
): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: process.env.NEXT_CLAUDE_API_KEY,
  });

  const prompt = `You are a research assistant tasked with analyzing search results and creating a structured research summary : Start response with { and end with }.
Required JSON Structure:
{
  "factsheet": "Write a factsheet of the podcast script based on these subtopics : 

   Trace the evolutionary timeline of the topic
- Identify key turning points and paradigm shifts
- Document notable figures and their contributions
- Present quantifiable data and statistics with sources when available
- Highlight technological or methodological breakthroughs
- Identify current state-of-the-art developments
- Examine cultural and economic implications
- Analyze current and potential future applications
- Document controversies or ethical considerations
- Note potential “aha” moments
- Include contrasting viewpoints from recognized authorities
- Note any ongoing debates or unresolved questions
- Identify counterintuitive facts or surprising discoveries
- Note memorable analogies or explanations
- Highlight human interest angles
- Distinguish between established facts and emerging theories

}

Search Results:
${JSON.stringify(searchResults, null, 2)}`;

  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 4096,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  return (response.content[0] as any).text;
}

const generateOutline = async (context: any, searchResults: any) => {
  const anthropic = new Anthropic({
    apiKey: process.env.NEXT_CLAUDE_API_KEY,
  });

  const prompt = `You are a podcast outline generator. Using the context provided below, create a compelling podcast outline formatted as a JSON array. The outline should include:
Search Results:
${JSON.stringify(searchResults, null, 2)} 

1. An introduction that sets up the main themes
2. Six distinct subtopics, each with a four-line summary explaining:
   - The key point or argument
   - Supporting evidence or examples
   - How it connects to the broader narrative
3. A conclusion that synthesizes the most fascinating points and intriguing elements discussed

The outline should maintain a narrative flow, with each subtopic linking with previous ones. 

[CONTEXT]
{context}
[END CONTEXT]

Return the outline in the following JSON format:

{
  "title": "string",
  "introduction": {
    "hook": "string",
    "main_themes": ["string"],
    "narrative_setup": "string"
  },
  "subtopics": [
    {
      "title": "string",
      "key_point": "string",
      "supporting_evidence": "string",
      "narrative_connection": "string"
    }
  ],
  "conclusion": {
    "key_insights": ["string"],
    "fascinating_elements": ["string"],
    "final_thoughts": "string"
  }
}

##FURTHER GUIDELINES 

- Ensure each subtopic is substantive and engaging. 
- Avoiding surface-level observations. 
- Make explicit connections between subtopics to create a cohesive narrative thread throughout the podcast.
- If appropriate, make one subtopic the focus of biographical, or backstory material.
- If appropriate, make one subtopic the focus of controversies and debates.
- If appropriate, include a 'breakthrough moment' where key revelations occur within at least one subtopic.

`;

  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 4096,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  return (response.content[0] as any).text;
};

const generateScript = async (context: any, outline: any) => {
  const subtopics = outline.subtopics;

  // Generate introduction (500 words)
  let intro = "";
  let introWordCount = 0;
  while (introWordCount < 350) {
    const remainingWords = 350 - introWordCount;
    const response = await askClaude(
      `Create a natural, engaging introduction for a podcast conversation between two hosts:
     This is your context : ${context}

     YOUR TASK HERE IS TO CREATE A INTRODUCTION FOR THE PODCAST WITH THIS DATA: 
     HOOK: ${outline.introduction.hook}
     MAIN THEMES: ${outline.introduction.main_themes}
     NARRATIVE SETUP: ${outline.introduction.narrative_setup}
        ## Response Example: 
      Always identify speakers as
         <Speaker 1> and <Speaker Two>, within angel brackets  
          Example of speaker identification 

        <Speaker 1>: <excited> You know, the idea of vertical flight has captured human imagination for centuries! </excited>

\n\n<Speaker 2>: <intrigued> Hmm, really? I didn't realize the concept went back that far. What kind of early designs are you referring to?
      - Create ${remainingWords} words
      - Focus on setting up the topic and sparking interest
      - Natural dialogue that flows smoothly ${
        intro
          ? `\n contine from this Previous content IS THIS: ${intro} CONTINUE TO EXAPAND THIS BASED ON - HOOK MAIN THEMES AND SETUP DONT REPEAT STUFF AT ALL`
          : ""
      }`
    );
    intro += response;
    introWordCount = intro.split(/\s+/).length;
  }

  // Generate main content (1600 words)
  let mainContent = "";
  let subtopicContent = "";

  for (const subtopic of subtopics) {
    subtopicContent = "";
    let subtopicWordCount = 0;

    while (subtopicWordCount < 400) {
      const remainingWords = 400 - subtopicWordCount;
      const response = await askClaude(
        `Continue the podcast conversation, focusing on this subtopic:
        The title of the subtopic is: ${subtopic.title}
        Key point: ${subtopic.key_point}
        Supporting evidence: ${subtopic.supporting_evidence}
        Narrative connection: ${subtopic.narrative_connection}
        Context: ${context}
        Current Subtopic: ${subtopic}
           ## Response Example: 
      Always identify speakers as
         <Speaker 1> and <Speaker Two>, within angel brackets  
          Example of speaker identification 

        <Speaker 1>: <excited> You know, the idea of vertical flight has captured human imagination for centuries! </excited>

\n\n<Speaker 2>: <intrigued> Hmm, really? I didn't realize the concept went back that far. What kind of early designs are you referring to?
        ${
          subtopicContent
            ? `continue from the previous content for this subtopic: ${subtopicContent}`
            : "Can you write 400 words on the above topic"
        }
        //   ## Create ${remainingWords} words that:
        // - if this the first time you are writing for this subtopic, then write a detailed introduction for this main deepdive
        // - Continue the natural flow of conversation 
        // - Explore this subtopic in detail with examples
        // - Connect points smoothly without forced transitions
        // - Avoid any concluding statements
        // - Avoid any concluding statements even if you have reached the end of the subtopic
        // - Build on previous discussion without repetition`
      );

      subtopicContent += response;
      subtopicWordCount = subtopicContent.split(/\s+/).length;
    }

    mainContent += subtopicContent; // Add completed subtopic content to main content
  }

  // Generate conclusion (300 words)
  let conclusion = "";
  let conclusionWordCount = 0;
  while (conclusionWordCount < 300) {
    const remainingWords = 300 - conclusionWordCount;
    const response = await askClaude(
      ` Your task is to write a conclusion for the podcast conversation:

      Context: ${context}
      Key insights: ${outline.conclusion.key_insights}
      Fascinating elements: ${outline.conclusion.fascinating_elements}
      Final thoughts: ${outline.conclusion.final_thoughts}

      ${
        conclusion
          ? `this is a previous conclusion: ${conclusion} continue here smoothly`
          : "Create a 300 word conclusion"
      }

      ## Response Example: 
      Always identify speakers as
         <Speaker 1> and <Speaker Two>, within angel brackets  
          Example of speaker identification 

        <Speaker 1>: <excited> You know, the idea of vertical flight has captured human imagination for centuries! </excited>

\n\n<Speaker 2>: <intrigued> Hmm, really? I didn't realize the concept went back that far. What kind of early designs are you referring to?
      Create ${remainingWords} words that:
      - Wrap up key insights organically through dialogue
      - Discuss broader implications
      - End with an engaging final thought
      - Maintain the conversational tone
      - Avoid repeating earlier points`
    );

    conclusion += response;
    conclusionWordCount = conclusion.split(/\s+/).length;
  }

  // if (!intro || !mainContent || !conclusion) {
  //   throw new Error("Failed to generate complete script");
  // }

  // complete_script = intro + mainContent + conclusion;
  return `
  INTRODUCTION: ${intro}
  MAIN CONTENT: ${mainContent}
  CONCLUSION: ${conclusion}
  `;
};


type DialogueEntry = {
  id: number;
  text: string;
};

function parseScriptToJSON(script: string): DialogueEntry[] {
  if (!script || typeof script !== 'string') {
    return [];
  }

  const result: DialogueEntry[] = [];
  let currentId = 1;

  try {
    // Split by newlines and clean up
    const lines = script.split("\n")
      .map(line => line.trim())
      .filter(line => line !== "")
      // Instead of filtering out lines that start with sections,
      // remove the section prefix if it exists
      .map(line => line.replace(/^(INTRODUCTION|MAIN CONTENT|CONCLUSION):\s*/i, ''));

    for (const line of lines) {
      // Try to match speaker pattern with more flexible regex
      const speakerMatch = line.match(/<Speaker\s*(\d+)>:?\s*(.*?)$/i);
      
      if (speakerMatch) {
        const [_, speakerId, text] = speakerMatch;
        
        // Clean the text content
        const cleanText = text
          .trim()
          .replace(/<[^>]*>/g, '') // Remove all HTML-like tags
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim();

        if (cleanText) {
          result.push({
            id: parseInt(speakerId) || currentId++,
            text: cleanText
          });
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error parsing script:', error);
    return [];
  }
}


export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Missing search query" },
      { status: 400 }
    );
  }

  try {
    // 1. Get research from Brave
    const searchResults = await fetchWebResearch(query);

    // 2. Generate context with Claude
    const context = await generateContext(searchResults, query);
    // Clean JSON string by removing any text before first { and after last }

    // Clean the context string before parsing
    // console.log(context);

    console.log("Generating outline now");
    const outline = await generateOutline(context, searchResults);

    console.log(outline);
    // 3. Generate podcast script with GPT-4

    const jsonParsedOutline = JSON.parse(outline);
    console.log(jsonParsedOutline);

    console.log("GENERATING SCRIPT NOW");
    // }
    const podcastScript = await generateScript(context, jsonParsedOutline);
    const parsedScript = parseScriptToJSON(podcastScript);

    return NextResponse.json({
      // searchResults,
      outline: jsonParsedOutline,
      script: podcastScript,
      parsedScript: parsedScript
    });
  } catch (error: any) {
    console.error("Script Generation Error:", error);
    return NextResponse.json(
      { error: "Failed to generate podcast script", details: error.message },
      { status: 500 }
    );
  }
}