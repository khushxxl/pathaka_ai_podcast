"use client";
import { CodeBlock } from "@/components/code-block";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { Mic, Pause, Play, Download } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { useRef, useEffect } from "react";

interface Topic {
  title: string;
  description: string;
  tags: string[];
}

interface ResearchResponse {
  research: {
    content: Array<{
      text: string;
    }>;
  };
  brave_search_results: Array<{
    title: string;
    description: string;
    url: string;
  }>;
  podcast_script: any[];
  parsedScript: any[];
  error?: string;
}

export default function ResearchPodcast() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [podcastScript, setPodcastScript] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [podScript, setPodScript] = useState<any[]>([]);
  const [podcastAudio, setPodcastAudio] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [prompt, setPrompt] = useState("");

  const handlePlayPauseAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSliderChange = (value: number[]) => {
    const newTime = value[0];
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (audioRef.current) {
      const handleLoadedMetadata = () => {
        setDuration(audioRef.current?.duration || 0);
      };

      const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      };

      audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
      audioRef.current.addEventListener("timeupdate", handleTimeUpdate);

      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener(
            "loadedmetadata",
            handleLoadedMetadata
          );
          audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        }
      };
    }
  }, [podcastAudio]);

  const handleGenerateElevenLabsPodcast = async () => {
    setLoading(true);
    setError("");
    setPodcastAudio("");
    
    try {
      const response = await fetch(`/api/elevenlabs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script: podScript }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate audio: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const audioFile = new Blob([audioBlob], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioFile);
      
      if (podcastAudio) {
        URL.revokeObjectURL(podcastAudio);
      }
      
      setPodcastAudio(audioUrl);
      
      setIsPlaying(false);
      setCurrentTime(0);
      
      if (audioRef.current) {
        audioRef.current.load();
      }
    } catch (error) {
      console.error("Error:", error);
      setError(error instanceof Error ? error.message : "Failed to generate audio");
    } finally {
      setLoading(false);
    }
  };

  const handleGetSuggestions = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuggestionsLoading(true);
    setError("");
    setTopics([]);

    try {
      const response = await fetch(
        `/api/topics?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch suggestions");
      }

      setTopics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleGeneratePodcast = async (selectedTopic: string) => {
    setLoading(true);
    setError("");
    setPodcastScript("");
    setSearchResults([]);
    setShowSuggestions(false);

    try {
      const response = await fetch(
        `/api/research?q=${encodeURIComponent(
          selectedTopic
        )}&prompt=${encodeURIComponent(prompt)}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      const data: ResearchResponse = await response.json();

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from API');
      }

      setPodcastScript(JSON.stringify(data, null, 2));
      setPodScript(data.parsedScript || []);
      setSearchResults(data.brave_search_results || []);
    } catch (err) {
      console.error('Podcast generation error:', err);
      setError(err instanceof Error ? 
        `Failed to generate podcast: ${err.message}` : 
        "An unexpected error occurred while generating the podcast"
      );
    } finally {
      setLoading(false);
    }
  };

  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      <div className="flex flex-col items-center justify-center space-y-6 p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
            <Mic className="h-8 w-8 text-white animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-48 bg-gray-700 rounded animate-pulse" />
            <div className="h-3 w-32 bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <span className="text-gray-700 font-semibold">Generating audio...</span>
      </div>

      {/* Podcast Script Skeleton */}
      <div className="mb-8">
        <div className="h-8 w-64 bg-gray-800 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-3/4" />
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-5/6" />
          <div className="h-4 bg-gray-800 rounded w-full" />
        </div>
      </div>

      {/* Reference Sources Skeleton */}
      <div>
        <div className="h-8 w-48 bg-gray-800 rounded mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border p-4 rounded">
              <div className="h-5 bg-gray-800 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-800 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Research Podcast Generator</h1>

      {showSuggestions ? (
        <>
          <form onSubmit={handleGetSuggestions} className="mb-8">
            <div className="flex gap-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What topics interest you?"
                className="flex-1 p-2 border rounded"
                required
              />
              <button
                type="submit"
                disabled={suggestionsLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                {suggestionsLoading ? "Finding topics..." : "Get Topic Ideas"}
              </button>
            </div>
            <div className="flex mt-5">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Prompt"
                className=" p-2 border rounded w-[680px]"
              />
            </div>
          </form>

          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          {suggestionsLoading ? (
            <div className="space-y-4 ">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-6 bg-gray-800 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-800 rounded w-full mb-2" />
                  <div className="flex gap-2 ">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-6 bg-gray-800 rounded w-16" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className=" grid grid-cols-3 gap-5 ">
                {topics.map((topic, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                    onClick={() => handleGeneratePodcast(topic.title)}
                  >
                    <h3 className="text-lg font-semibold text-blue-600 mb-2">
                      {topic.title}
                    </h3>
                    {/* <p className="text-gray-600 mb-3">{topic.description}</p> */}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => setShowSuggestions(true)}
            className="mb-6 text-blue-500 hover:text-blue-600"
          >
            ← Back to Topics
          </button>

          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>

{podcastAudio && podcastAudio !== "" && (
                <Card className="p-6 bg-gray-900 border-gray-500 w-full max-w-2xl mt-10">
                  <div className="flex items-center gap-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-12 h-12 rounded-full bg-primary flex items-center justify-center bg-gray-800"
                      onClick={handlePlayPauseAudio}
                    >
                      {isPlaying ? (
                        <Pause className="h-6 w-6" />
                      ) : (
                        <Play className="h-6 w-6" />
                      )}
                    </Button>
                    <div className="flex-1 space-y-2">
                      <Slider
                        value={[currentTime]}
                        max={duration}
                        step={0.1}
                        onValueChange={(value) => handleSliderChange(value)}
                        className="w-full rounded-lg bg-gray-300 cursor-pointer mt-6"
                      />
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                    <a 
                      href={podcastAudio} 
                      download="generated_audio.mp3"
                      onClick={(e) => {
                        e.preventDefault();
                        const link = document.createElement('a');
                        link.href = podcastAudio;
                        link.download = 'generated_audio.mp3';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <Download className="h-5 w-5 text-white" />
                    </a>
                  </div>
                  <audio 
                    ref={audioRef} 
                    src={podcastAudio}
                    preload="auto"
                    onError={(e) => {
                      console.error("Audio playback error:", e);
                      setError("Failed to play audio. Please try downloading instead.");
                    }}
                  />
                </Card>
              )}

              {podcastScript && (
                <>
                  <Button
                    className="flex justify-center mt-5"
                    onClick={handleGenerateElevenLabsPodcast}
                  >
                    Generate Podcast
                  </Button>
                  <div className="whitespace-pre-wrap mt-5">
                    <CodeBlock code={podcastScript} />
                  </div>
                </>
              )}

              {searchResults?.length > 0 && (
                <div>
                  <h2 className="text-2xl font-semibold mb-4">
                    Reference Sources
                  </h2>
                  <div className="space-y-4">
                    {searchResults.map((result, index) => (
                      <div key={index} className="border p-4 rounded">
                        <h3 className="font-semibold">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {result.title}
                          </a>
                        </h3>
                        <p className="text-gray-600 mt-1">
                          {result.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
