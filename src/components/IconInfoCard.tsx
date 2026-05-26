import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import type { IconData } from '@/pages/Index';
import * as allSimpleIcons from 'simple-icons';
import { Link, Palette, Hash } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface IconInfoCardProps {
  icon: IconData;
  onColorSelect: (color: string) => void;
}

// Function to fetch original Simple Icon data using the slug
const getOriginalIconData = (slug: string) => {
  const icons = allSimpleIcons as unknown as Record<string, { slug: string; hex: string; source?: string }>;
  const iconKey = Object.keys(icons).find(key => 
    icons[key].slug === slug
  );
  return iconKey ? icons[iconKey] : null;
};

export const IconInfoCard: React.FC<IconInfoCardProps> = ({ icon, onColorSelect }) => {
  const originalData = getOriginalIconData(icon.slug);
  const originalHex = originalData?.hex ? `#${originalData.hex}` : 'N/A';
  const sourceUrl = originalData?.source;
  const isColorAvailable = originalHex !== 'N/A';

  const handleColorClick = () => {
    if (isColorAvailable) {
      onColorSelect(originalHex);
    }
  };

  return (
    <Card className="w-full flex-grow bg-muted/50 border-none shadow-none flex flex-col">
      <CardContent className="p-4 pt-2 text-sm space-y-3 flex flex-col flex-grow">
        <h3 className="text-lg font-semibold mb-2">Information</h3>
        
        {/* Slug */}
        <div>
          <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium uppercase">
            <Hash className="h-3 w-3" /> Slug:
          </span>
          <span className="font-mono text-foreground text-base break-all">{icon.slug}</span>
        </div>
        
        {/* Original Color */}
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium uppercase cursor-default">
                <Palette className="h-3 w-3" /> Color:
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Original Icon Color</p>
            </TooltipContent>
          </Tooltip>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-foreground text-base">{originalHex}</span>
            {isColorAvailable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleColorClick}
                    className="w-4 h-4 rounded-sm border cursor-pointer hover:ring-2 ring-primary transition-all flex-shrink-0"
                    style={{ backgroundColor: originalHex }}
                    aria-label={`Use color ${originalHex}`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Use Original Color</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        
        {/* Original Source - Pushed to the bottom */}
        {sourceUrl && (
          <div className="pt-3 border-t mt-auto">
            <a 
              href={sourceUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline flex items-center gap-1 text-xs font-medium"
            >
              <Link className="h-4 w-4" />
              Original Source
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
};