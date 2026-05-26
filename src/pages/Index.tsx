import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { IconCard } from "@/components/IconCard";
import * as allSimpleIcons from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Bookmark, Search, Shuffle, Settings, X, Code } from "lucide-react";
import { ColorPicker } from "@/components/ColorPicker";
import { Button } from "@/components/ui/button";
import { BatchDownloaderSheet } from "@/components/BatchDownloaderSheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BackToTopButton } from "@/components/BackToTopButton";
import { ResolutionDialog } from "@/components/ResolutionDialog";
import { useLocation } from "react-router-dom";
import { useLenis } from "@/components/LenisProvider";
import { useDynamicPlaceholder } from "@/hooks/use-dynamic-placeholder";
import { useFavicon } from "@/hooks/use-favicon"; // Importando o novo hook

export interface IconData {
  title: string;
  slug: string;
}

const iconList: IconData[] = Object.values(allSimpleIcons)
  .filter((icon): icon is SimpleIcon => 
    typeof icon === 'object' && icon !== null && 'title' in icon
  )
  .map(icon => ({
    title: icon.title,
    slug: icon.slug,
  }));

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const getRandomColor = () => `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;

const ITEMS_PER_PAGE = 50;
const RESOLUTION_STORAGE_KEY = 'iconGeneratorResolution';

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [color, setColor] = useState(getRandomColor());
  const [isRandom, setIsRandom] = useState(true);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [shuffledIcons, setShuffledIcons] = useState<IconData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'random' | 'az' | 'za'>('random');
  const [selectedIcons, setSelectedIcons] = useState(new Set<string>());
  const [resolution, setResolution] = useState(() => {
    // Initialize resolution from localStorage
    if (typeof window !== 'undefined') {
      const storedResolution = localStorage.getItem(RESOLUTION_STORAGE_KEY);
      if (storedResolution) {
        const parsedResolution = parseInt(storedResolution, 10);
        // Ensure the read value is a positive number
        if (!isNaN(parsedResolution) && parsedResolution > 0) {
          return parsedResolution;
        }
      }
    }
    return 256; // Default fallback
  });
  const [isResolutionDialogOpen, setIsResolutionDialogOpen] = useState(false);
  
  const lenis = useLenis();
  
  // Hook for Dynamic Placeholder
  const dynamicPlaceholder = useDynamicPlaceholder(iconList);
  
  // Hook for Dynamic Favicon
  useFavicon(color); // Usando o hook aqui

  useEffect(() => {
    try {
      const storedColors = localStorage.getItem("recentColors");
      if (storedColors) setRecentColors(JSON.parse(storedColors));
    } catch (error) {
      console.error("Failed to parse recent colors from localStorage", error);
      localStorage.removeItem("recentColors");
    }
    setShuffledIcons(shuffleArray(iconList));
  }, []);
  
  // Ensures the page starts at the top immediately on mount (after F5)
  useEffect(() => {
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    }
  }, [lenis]);

  const updateRecentColors = (newColor: string) => {
    const updatedColors = [newColor, ...recentColors.filter((c) => c !== newColor)].slice(0, 10);
    setRecentColors(updatedColors);
    localStorage.setItem("recentColors", JSON.stringify(updatedColors));
  };
  
  const removeRecentColor = (colorToRemove: string) => {
    const updatedColors = recentColors.filter(c => c !== colorToRemove);
    setRecentColors(updatedColors);
    localStorage.setItem("recentColors", JSON.stringify(updatedColors));
  };

  const handleSelectIcon = (slug: string) => {
    setSelectedIcons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slug)) {
        newSet.delete(slug);
      } else {
        newSet.add(slug);
      }
      return newSet;
    });
  };

  const handleResolutionChange = (newResolution: number) => {
    setResolution(newResolution);
    // Save the new resolution to localStorage
    localStorage.setItem(RESOLUTION_STORAGE_KEY, newResolution.toString());
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (lenis) {
      // Smooth scroll to top
      lenis.scrollTo(0, { duration: 0.5 });
    }
  };

  const sortedIcons = useMemo(() => {
    const icons = [...shuffledIcons];
    if (sortBy === 'az') {
      return icons.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === 'za') {
      return icons.sort((a, b) => b.title.localeCompare(a.title));
    }
    return icons;
  }, [sortBy, shuffledIcons]);

  const filteredIcons = useMemo(() => {
    setCurrentPage(1);
    if (!searchQuery) return sortedIcons;

    const query = searchQuery.toLowerCase();

    // 1. Filter all icons that contain the query
    const matches = sortedIcons.filter((icon) =>
      icon.title.toLowerCase().includes(query) || icon.slug.toLowerCase().includes(query)
    );

    // 2. Sort results
    matches.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aSlug = a.slug.toLowerCase();
      const bSlug = b.slug.toLowerCase();

      const aStarts = aTitle.startsWith(query) || aSlug.startsWith(query);
      const bStarts = bTitle.startsWith(query) || bSlug.startsWith(query);

      // Prioritize those that start with the query
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // If both start or neither starts, sort alphabetically by title
      return aTitle.localeCompare(bTitle);
    });

    return matches;
  }, [searchQuery, sortedIcons]);

  const pageCount = Math.ceil(filteredIcons.length / ITEMS_PER_PAGE);
  const paginatedIcons = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredIcons.slice(start, end);
  }, [filteredIcons, currentPage]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="text-center mb-8 relative flex flex-col items-center">
        <div className="md:absolute md:right-0 md:top-0 mb-4 md:mb-0">
          <Button variant="outline" size="sm" asChild className="gap-2 border-border hover:bg-accent hover:text-accent-foreground">
            <a href="/playground" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              API System
            </a>
          </Button>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Custom Icon Generator</h1>
        <p className="text-muted-foreground mt-2">
          Search, select, customize, and download icons in the format you need.
        </p>
      </header>

      <main>
        <div className="bg-background/80 backdrop-blur-sm p-4 rounded-lg border mb-8 flex flex-col gap-4">
          <div className="relative flex-grow w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={dynamicPlaceholder} // Using dynamic placeholder
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={searchQuery ? "pl-10 pr-10" : "pl-10"} // Adjust right padding if there is text
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:bg-transparent p-0"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Controls: Left (Colors), Center (Resolution), Right (Filters) */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            
            {/* Left: Colors and Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div><ColorPicker value={color} onChange={(c) => { setColor(c); setIsRandom(false); }} /></div>
                </TooltipTrigger>
                <TooltipContent><p>Select Color</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => { setColor(getRandomColor()); setIsRandom(true); }}>
                    <Shuffle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Random Color</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => updateRecentColors(color)}>
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save Color</TooltipContent>
              </Tooltip>
              
              <div className="flex gap-2 flex-wrap ml-2">
                {recentColors.map((recentColor) => (
                  <div key={recentColor} className="relative group">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="w-8 h-8 rounded-full border"
                          style={{ backgroundColor: recentColor }}
                          onClick={() => { setColor(recentColor); setIsRandom(false); }}
                          aria-label={`Select color ${recentColor}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent><p>Use color {recentColor}</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => removeRecentColor(recentColor)}
                          className="absolute -top-1 -right-1 bg-card border rounded-full p-0.5 hidden group-hover:flex items-center justify-center"
                          aria-label={`Remove color ${recentColor}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent><p>Remove color</p></TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Center: Resolution Settings Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => setIsResolutionDialogOpen(true)} className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {resolution}x{resolution}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Configure PNG/ICO Resolution</p></TooltipContent>
            </Tooltip>

            {/* Right: Sorting */}
            <ToggleGroup type="single" value={sortBy} onValueChange={(value) => value && setSortBy(value as 'random' | 'az' | 'za')}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="random" aria-label="Sort randomly">
                    <Shuffle className="h-4 w-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Random</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="az" aria-label="Sort A to Z" className="whitespace-nowrap">
                    A-Z
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Alphabetical Order</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="za" aria-label="Sort Z to A" className="whitespace-nowrap">
                    Z-A
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent><p>Reverse Alphabetical Order</p></TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </div>
        </div>

        {paginatedIcons.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {paginatedIcons.map((icon) => (
                <IconCard 
                  key={icon.slug} 
                  icon={icon} 
                  color={color} 
                  isRandom={isRandom}
                  resolution={resolution} // Passing resolution
                  isSelected={selectedIcons.has(icon.slug)}
                  onSelect={handleSelectIcon}
                />
              ))}
            </div>
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => { 
                          e.preventDefault(); 
                          handlePageChange(Math.max(currentPage - 1, 1)); 
                        }} 
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} 
                      />
                    </TooltipTrigger>
                    <TooltipContent><p>Previous Page</p></TooltipContent>
                  </Tooltip>
                </PaginationItem>
                <PaginationItem>
                  <span className="px-4 py-2 text-sm font-medium">Page {currentPage} of {pageCount}</span>
                </PaginationItem>
                <PaginationItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PaginationNext 
                        href="#" 
                        onClick={(e) => { 
                          e.preventDefault(); 
                          handlePageChange(Math.min(currentPage + 1, pageCount)); 
                        }} 
                        className={currentPage === pageCount ? "pointer-events-none opacity-50" : ""} 
                      />
                    </TooltipTrigger>
                    <TooltipContent><p>Next Page</p></TooltipContent>
                  </Tooltip>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No icons found for "{searchQuery}".</p>
          </div>
        )}
      </main>

      <BatchDownloaderSheet
        selectedIcons={selectedIcons}
        allIcons={iconList}
        color={color}
        isRandom={isRandom}
        resolution={resolution} // Passing resolution
        onClear={() => setSelectedIcons(new Set())}
        onRemoveIcon={handleSelectIcon}
      />
      
      <BackToTopButton />

      <ResolutionDialog
        open={isResolutionDialogOpen}
        onOpenChange={setIsResolutionDialogOpen}
        currentResolution={resolution}
        onResolutionChange={handleResolutionChange} // Using the new function
      />
    </div>
  );
};

export default Index;