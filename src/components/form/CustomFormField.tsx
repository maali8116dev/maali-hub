import * as React from "react";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import { LucideIcon, Eye, EyeOff } from "lucide-react";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

export enum FormFieldType {
  INPUT = "input",
  PASSWORD = "password",
  EMAIL = "email",
  NUMBER = "number",
  TEL = "tel",
  PHONE_INTERNATIONAL = "phone_international",
  URL = "url",
  TEXTAREA = "textarea",
  CHECKBOX = "checkbox",
  SELECT = "select",
  FILE = "file",
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface BaseFieldProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

interface InputFieldProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFieldProps<TFieldValues> {
  fieldType:
    | FormFieldType.INPUT
    | FormFieldType.PASSWORD
    | FormFieldType.EMAIL
    | FormFieldType.NUMBER
    | FormFieldType.TEL
    | FormFieldType.URL;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  type?: "text" | "password" | "email" | "number" | "tel" | "url";
  min?: number;
  max?: number;
  step?: number;
}

interface PhoneInternationalFieldProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFieldProps<TFieldValues> {
  fieldType: FormFieldType.PHONE_INTERNATIONAL;
  defaultCountry?: string;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
}

interface TextareaFieldProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFieldProps<TFieldValues> {
  fieldType: FormFieldType.TEXTAREA;
  rows?: number;
  maxLength?: number;
}

interface CheckboxFieldProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFieldProps<TFieldValues> {
  fieldType: FormFieldType.CHECKBOX;
  checkboxLabel?: string;
}

interface SelectFieldProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFieldProps<TFieldValues> {
  fieldType: FormFieldType.SELECT;
  options: SelectOption[];
}

interface FileFieldProps<TFieldValues extends FieldValues = FieldValues>
  extends BaseFieldProps<TFieldValues> {
  fieldType: FormFieldType.FILE;
  accept?: string;
  multiple?: boolean;
}

export type CustomFormFieldProps<TFieldValues extends FieldValues = FieldValues> =
  | InputFieldProps<TFieldValues>
  | TextareaFieldProps<TFieldValues>
  | CheckboxFieldProps<TFieldValues>
  | SelectFieldProps<TFieldValues>
  | FileFieldProps<TFieldValues>
  | PhoneInternationalFieldProps<TFieldValues>;

const FieldRenderer = <TFieldValues extends FieldValues = FieldValues>({
  field,
  props,
}: {
  field: any;
  props: CustomFormFieldProps<TFieldValues>;
}) => {
  const { fieldType, disabled, placeholder } = props;
  const [showPassword, setShowPassword] = React.useState(false);

  switch (fieldType) {
    case FormFieldType.INPUT:
    case FormFieldType.PASSWORD:
    case FormFieldType.EMAIL:
    case FormFieldType.NUMBER:
    case FormFieldType.TEL:
    case FormFieldType.URL: {
      const inputProps = props as InputFieldProps<TFieldValues>;
      const {
        icon: Icon,
        iconPosition = "left",
        type,
        min,
        max,
        step,
      } = inputProps;

      const isPassword = fieldType === FormFieldType.PASSWORD;
      const inputType =
        type ||
        (isPassword
          ? showPassword
            ? "text"
            : "password"
          : fieldType === FormFieldType.EMAIL
            ? "email"
            : fieldType === FormFieldType.NUMBER
              ? "number"
              : fieldType === FormFieldType.TEL
                ? "tel"
                : fieldType === FormFieldType.URL
                  ? "url"
                  : "text");

      const inputElement = (
        <Input
          type={inputType}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          {...field}
          className={cn(
            Icon && iconPosition === "left" && "pl-10",
            Icon && iconPosition === "right" && !isPassword && "pr-10",
            isPassword && "pr-10",
            props.className
          )}
        />
      );

      if (isPassword) {
        return (
          <div className="relative">
            {Icon && iconPosition === "left" && (
              <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            )}
            <FormControl>{inputElement}</FormControl>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={disabled}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        );
      }

      if (Icon) {
        return (
          <div className="relative">
            {iconPosition === "left" && (
              <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            )}
            <FormControl>{inputElement}</FormControl>
            {iconPosition === "right" && (
              <Icon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            )}
          </div>
        );
      }

      return <FormControl>{inputElement}</FormControl>;
    }

    case FormFieldType.PHONE_INTERNATIONAL: {
      const phoneProps = props as PhoneInternationalFieldProps<TFieldValues>;
      const { defaultCountry = "International" } = phoneProps;
      
      return (
        <FormControl>
          <PhoneInput
            international
            defaultCountry={defaultCountry as any}
            value={field.value as string | undefined}
            onChange={(value) => field.onChange(value || "")}
            disabled={disabled}
            placeholder={placeholder}
            className={cn("PhoneInput", props.className)}
            numberInputProps={{
              className: cn(
                "flex h-9 w-full bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              ),
            }}
          />
        </FormControl>
      );
    }

    case FormFieldType.TEXTAREA: {
      const textareaProps = props as TextareaFieldProps<TFieldValues>;
      const { rows, maxLength } = textareaProps;
      const currentLength = field.value?.length || 0;
      const remaining = maxLength ? maxLength - currentLength : null;
      
      return (
        <div className="space-y-1">
          <FormControl>
            <Textarea
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              maxLength={maxLength}
              {...field}
              className={props.className}
            />
          </FormControl>
          {maxLength && (
            <div className="flex justify-end">
              <span className={cn(
                "text-xs text-muted-foreground",
                remaining !== null && remaining < maxLength * 0.1 && "text-destructive"
              )}>
                {currentLength} / {maxLength} characters
              </span>
            </div>
          )}
        </div>
      );
    }

    case FormFieldType.CHECKBOX: {
      const checkboxProps = props as CheckboxFieldProps<TFieldValues>;
      const { checkboxLabel } = checkboxProps;
      return (
        <FormControl>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={props.name}
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
            {checkboxLabel && (
              <label
                htmlFor={props.name}
                className={cn(
                  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                  disabled && "cursor-not-allowed opacity-70"
                )}
              >
                {checkboxLabel}
              </label>
            )}
          </div>
        </FormControl>
      );
    }

    case FormFieldType.SELECT: {
      const selectProps = props as SelectFieldProps<TFieldValues>;
      const { options } = selectProps;
      return (
        <FormControl>
          <Select
            onValueChange={field.onChange}
            value={field.value}
            disabled={disabled}
          >
            <SelectTrigger className={props.className}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormControl>
      );
    }

    case FormFieldType.FILE: {
      const fileProps = props as FileFieldProps<TFieldValues>;
      const { accept, multiple } = fileProps;
      return (
        <FormControl>
          <Input
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            onChange={(e) => {
              const files = e.target.files;
              if (files) {
                field.onChange(multiple ? Array.from(files) : files[0]);
              }
            }}
            className={cn("cursor-pointer", props.className)}
          />
        </FormControl>
      );
    }

    default:
      return null;
  }
};

const CustomFormField = <TFieldValues extends FieldValues = FieldValues>(
  props: CustomFormFieldProps<TFieldValues>
) => {
  const {
    control,
    name,
    label,
    description,
    fieldType,
    required,
    className,
  } = props;

  const isCheckbox = fieldType === FormFieldType.CHECKBOX;
  const checkboxProps = props as CheckboxFieldProps<TFieldValues>;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex-1", className)}>
          {!isCheckbox && label && (
            <FormLabel>
              {label}
              {required && (
                <span className="text-destructive ml-0.5">*</span>
              )}
            </FormLabel>
          )}
          <FieldRenderer field={field} props={props} />
          {description && (
            <FormDescription>{description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default CustomFormField;









