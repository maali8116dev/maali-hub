import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type PartnerLinkedUser = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
};

function formatPartnerUserDisplay(u: PartnerLinkedUser | undefined) {
  if (!u) return "";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || `${u.user_id.slice(0, 8)}…`;
}

type PartnerLinkedUserComboboxProps = {
  users: PartnerLinkedUser[];
  value: string;
  onValueChange: (userId: string) => void;
  disabled?: boolean;
  id?: string;
};

export function PartnerLinkedUserCombobox({
  users,
  value,
  onValueChange,
  disabled,
  id,
}: PartnerLinkedUserComboboxProps) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...users].sort((a, b) =>
        formatPartnerUserDisplay(a).localeCompare(formatPartnerUserDisplay(b), undefined, {
          sensitivity: "base",
        })
      ),
    [users]
  );

  const selected = users.find((u) => u.user_id === value);
  const triggerLabel = !value
    ? "No linked user"
    : selected
      ? formatPartnerUserDisplay(selected)
      : `User ${value.slice(0, 8)}…`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or user id…" />
          <CommandList>
            <CommandEmpty>No partner user found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="no-linked-user"
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                No linked user
              </CommandItem>
              {sorted.map((u) => {
                const label = formatPartnerUserDisplay(u);
                return (
                  <CommandItem
                    key={u.user_id}
                    value={`${label} ${u.user_id}`}
                    onSelect={() => {
                      onValueChange(u.user_id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4 shrink-0", value === u.user_id ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{label}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {u.user_id.slice(0, 8)}…
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
