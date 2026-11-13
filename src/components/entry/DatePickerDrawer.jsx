import React from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DatePickerDrawer({ open, onOpenChange, value, onChange }) {
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  const handleSelect = (day) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Selecionar Data</DrawerTitle>
        </DrawerHeader>
        <div className="flex justify-center pb-6">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={handleSelect}
            locale={ptBR}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}