import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { driverPhoto } from "@/lib/driver-photos.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ZoomIn, ZoomOut, ImageOff } from "lucide-react";

// Each request validates the current load; drivers never receive reusable storage URLs.
export function DriverPhoto({ id, path, userId }: { id: string; path: string; userId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const download = useServerFn(driverPhoto);
  const { data, error, refetch } = useQuery({ queryKey: ["driver-photo", userId, id], gcTime: 0, staleTime: 0, refetchInterval: 30000, queryFn: async () => {
    const r = await download({ data: { id } });
    const bytes = Uint8Array.from(atob(r.base64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: r.mime });
  } });
  useEffect(() => { if (!data) return; const next = URL.createObjectURL(data); setUrl(next); return () => URL.revokeObjectURL(next); }, [data]);
  return <><Button variant="outline" className="h-20 w-20 p-1 shrink-0" aria-label="Ampliar foto enviada" onClick={async () => { const r = await refetch(); if (r.error) return; setZoom(1); setOpen(true); }} disabled={!url || !!error}>
    {url && !error ? <img src={url} alt="Foto enviada" className="h-full w-full object-contain" /> : error ? <ImageOff /> : "..."}
  </Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Documento enviado</DialogTitle></DialogHeader>
    <div className="flex gap-2 items-center"><Button variant="outline" size="icon" aria-label="Diminuir foto" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1, z - 0.5))}><ZoomOut /></Button><span>{Math.round(zoom * 100)}%</span><Button variant="outline" size="icon" aria-label="Aumentar foto" disabled={zoom >= 4} onClick={() => setZoom(z => Math.min(4, z + 0.5))}><ZoomIn /></Button></div>
    <div className="h-[65vh] overflow-auto touch-pan-x touch-pan-y">{url && !error && <img src={url} alt="Documento ampliado" className={`max-w-none object-contain ${({ 1: "w-full", 1.5: "w-[150%]", 2: "w-[200%]", 2.5: "w-[250%]", 3: "w-[300%]", 3.5: "w-[350%]", 4: "w-[400%]" } as Record<number, string>)[zoom]}`} />}</div>
  </DialogContent></Dialog></>;
}