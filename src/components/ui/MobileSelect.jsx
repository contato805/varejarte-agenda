import React, { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileSelect({ value, onValueChange, placeholder, children, label }) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Extract options from children (SelectItem elements)
  const options = [];
  React.Children.forEach(children, (child) => {
    if (child?.type === SelectItem || child?.props?.value !== undefined) {
      options.push({
        value: child.props.value,
        label: child.props.children,
        disabled: child.props.disabled,
      });
    }
  });

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    );
  }

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder || "Selecione";

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className={cn("line-clamp-1", !value && "text-muted-foreground")}>
          {selectedLabel}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{label || placeholder || "Selecione"}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                disabled={opt.disabled}
                onClick={() => {
                  onValueChange(opt.value);
                  setDrawerOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between w-full px-4 py-3 text-sm rounded-lg transition-colors",
                  opt.disabled && "opacity-50 pointer-events-none",
                  opt.value === value ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"
                )}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}