import React, { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Download, FileArchive, Trash2 } from 'lucide-react';
import type { IconData } from '@/pages/Index';
import { showError, showLoading, showSuccess, dismissToast } from '@/utils/toast';
import { ScrollArea } from './ui/scroll-area';
import { SelectedIconItem } from './SelectedIconItem';
import { DownloadFormatDialog, DownloadFormat } from './DownloadFormatDialog';
import { svgToPng, svgToIco } from '@/lib/image-converter';

const getRandomColor = () => `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;

interface BatchDownloaderSheetProps {
  selectedIcons: Set<string>;
  allIcons: IconData[];
  color: string;
  isRandom: boolean;
  resolution: number; // Nova propriedade
  onClear: () => void;
  onRemoveIcon: (slug: string) => void;
}

export const BatchDownloaderSheet: React.FC<BatchDownloaderSheetProps> = ({ selectedIcons, allIcons, color, isRandom, resolution, onClear, onRemoveIcon }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const selectedIconsDetails = allIcons.filter(icon => selectedIcons.has(icon.slug));

  const handleDownloadZip = async (format: DownloadFormat) => {
    setIsDownloading(true);
    setIsDialogOpen(false);
    const loadingToast = showLoading(`Preparing ${selectedIcons.size} icons as ${format.toUpperCase()}...`);
    const zip = new JSZip();

    try {
      const iconPromises = selectedIconsDetails.map(async (icon) => {
        try {
          const response = await fetch(`https://cdn.simpleicons.org/${icon.slug}`);
          if (!response.ok) return;
          const svgText = await response.text();
          const effectiveColor = isRandom ? getRandomColor() : color;
          const cleanColor = effectiveColor.substring(1);
          const fileName = `${icon.slug}-${cleanColor}.${format}`;

          let fileContent: Blob | string;

          if (format === 'svg') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, "image/svg+xml");
            doc.documentElement.setAttribute('fill', effectiveColor);
            const serializer = new XMLSerializer();
            fileContent = serializer.serializeToString(doc.documentElement);
          } else if (format === 'png') {
            fileContent = await svgToPng(svgText, resolution, effectiveColor); // Usando a resolução
          } else { // ico
            fileContent = await svgToIco(svgText, effectiveColor);
          }
          
          zip.file(fileName, fileContent);
        } catch (e) {
          console.error(`Failed to process icon ${icon.slug}:`, e);
        }
      });

      await Promise.all(iconPromises);

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `icons-${color.substring(1)}-${format}.zip`);
      dismissToast(loadingToast);
      showSuccess('Download started!');
    } catch (error) {
      console.error("Failed to create ZIP file:", error);
      dismissToast(loadingToast);
      showError('Failed to generate ZIP file.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (selectedIcons.size <= 1) {
    return null;
  }

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button className="fixed bottom-8 right-8 z-50 h-14 rounded-full shadow-lg flex items-center gap-3 px-6 animate-in fade-in-90 slide-in-from-bottom-10 duration-300">
            <FileArchive className="h-6 w-6" />
            <span className="text-lg font-semibold">{selectedIcons.size} selected</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px] flex flex-col" side="right">
          <SheetHeader>
            <SheetTitle>Selected Icons ({selectedIcons.size})</SheetTitle>
            <SheetDescription>
              Review your selection and download all icons at once. (PNG/ICO at {resolution}x{resolution})
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-grow my-4 pr-4">
            <div className="space-y-2">
              {selectedIconsDetails.map(icon => (
                <SelectedIconItem key={icon.slug} icon={icon} onRemove={onRemoveIcon} />
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-auto border-t pt-4">
            <Button onClick={() => setIsDialogOpen(true)} disabled={isDownloading} className="flex-grow">
              <Download className="h-4 w-4 mr-2" />
              Download ZIP
            </Button>
            <Button variant="outline" onClick={onClear} disabled={isDownloading}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <DownloadFormatDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onDownload={handleDownloadZip}
        isDownloading={isDownloading}
      />
    </>
  );
};