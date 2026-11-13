import React, { useState, useRef, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export default function TimePickerDrawer({ open, onOpenChange, value, onChange, title = "Selecionar Horário" }) {
  const [hour, setHour] = useState("08");
  const [minute, setMinute] = useState("00");
  const hourRef = useRef(null);

  useEffect(() => {
    if (open && value) {
      const [h, m] = value.split(":");
      setHour(h || "08");
      const mNum = parseInt(m || "0");
      const snapped = MINUTES.reduce((prev, curr) =>
        Math.abs(parseInt(curr) - mNum) < Math.abs(parseInt(prev) - mNum) ? curr : prev
      );
      setMinute(snapped);
    }
  }, [open, value]);

  useEffect(() => {
    if (open && hourRef.current) {
      setTimeout(() => {
        const activeEl = hourRef.current?.querySelector('[data-active="true"]');
        if (activeEl) {
          activeEl.scrollIntoView({ block: "center", behavior: "instant" });
        }
      }, 50);
    }
  }, [open, hour]);

  const handleConfirm = () => {
    onChange(`${hour}:${minute}`);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-4">
          <div className="flex gap-4">
            {/* Hours */}
            <div className="flex-1 space-y-1">
              <p className="text-xs font-medium text-muted-foreground text-center">Hora</p>
              <div ref={hourRef} className="h-48 overflow-y-auto rounded-lg border p-1 space-y-0.5">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    data-active={h === hour}
                    onClick={() => setHour(h)}
                    className={cn(
                      "w-full py-2 rounded-md text-sm font-medium transition-colors",
                      h === hour
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            {/* Minutes */}
            <div className="flex-1 space-y-1">
              <p className="text-xs font-medium text-muted-foreground text-center">Minuto</p>
              <div className="h-48 overflow-y-auto rounded-lg border p-1 space-y-0.5">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMinute(m)}
                    className={cn(
                      "w-full py-2 rounded-md text-sm font-medium transition-colors",
                      m === minute
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center text-2xl font-bold text-foreground">
            {hour}:{minute}
          </div>

          <Button onClick={handleConfirm} className="w-full">
            Confirmar
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}