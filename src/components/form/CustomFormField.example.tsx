/**
 * Example usage of CustomFormField component
 * 
 * This file demonstrates how to use the CustomFormField component
 * with React Hook Form in various scenarios.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form } from "@/components/ui/form";
import CustomFormField, { FormFieldType } from "./CustomFormField";
import { Mail, Phone, User, Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

// Example form schema
const applicationFormSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  contactEmail: z.string().email("Invalid email address"),
  contactPhone: z.string().min(10, "Invalid phone number"),
  location: z.string().min(2, "Location is required"),
  projectDescription: z.string().min(50, "Description must be at least 50 characters"),
  fundingAmount: z.string().min(1, "Funding amount is required"),
  businesssector: z.string().min(1, "Please select a business sector"),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
});

type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

export function ApplicationFormExample() {
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      companyName: "",
      contactEmail: "",
      contactPhone: "",
      location: "",
      projectDescription: "",
      fundingAmount: "",
      businesssector: "",
      termsAccepted: false
    },
  });

  const onSubmit = (data: ApplicationFormValues) => {
    console.log("Form data:", data);
    // Handle form submission
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Text Input with Icon */}
        <CustomFormField
          control={form.control}
          name="companyName"
          fieldType={FormFieldType.INPUT}
          label="Company Name"
          placeholder="Enter your company name"
          icon={Building2}
          iconPosition="left"
          required
        />

        {/* Email Input with Icon */}
        <CustomFormField
          control={form.control}
          name="contactEmail"
          fieldType={FormFieldType.EMAIL}
          label="Contact Email"
          placeholder="your.email@example.com"
          icon={Mail}
          iconPosition="left"
          required
        />

        {/* Phone Input with Icon */}
        <CustomFormField
          control={form.control}
          name="contactPhone"
          fieldType={FormFieldType.TEL}
          label="Contact Phone"
          placeholder="+1234567890"
          icon={Phone}
          iconPosition="left"
          required
        />

        {/* Select Dropdown */}
        <CustomFormField
          control={form.control}
          name="businesssector"
          fieldType={FormFieldType.SELECT}
          label="Business sector"
          placeholder="Select your business sector"
          options={[
            { value: "technology", label: "Technology" },
            { value: "agriculture", label: "Agriculture" },
            { value: "fintech", label: "FinTech" },
            { value: "healthcare", label: "Healthcare" },
            { value: "education", label: "Education" },
          ]}
          required
        />

        {/* Textarea */}
        <CustomFormField
          control={form.control}
          name="projectDescription"
          fieldType={FormFieldType.TEXTAREA}
          label="Project Description"
          placeholder="Describe your project in detail..."
          description="Provide a detailed description of your project (minimum 50 characters)"
          rows={6}
          maxLength={1000}
          required
        />

        {/* Number Input */}
        <CustomFormField
          control={form.control}
          name="fundingAmount"
          fieldType={FormFieldType.NUMBER}
          label="Funding Amount Requested"
          placeholder="50000"
          min={1000}
          max={1000000}
          step={1000}
          required
        />

        {/* Checkbox */}
        <CustomFormField
          control={form.control}
          name="termsAccepted"
          fieldType={FormFieldType.CHECKBOX}
          checkboxLabel="I accept the terms and conditions"
          required
        />

        {/* File Upload */}
        {/* <CustomFormField
          control={form.control}
          name="businessPlan"
          fieldType={FormFieldType.FILE}
          label="Business Plan Document"
          description="Upload your business plan (PDF, DOC, DOCX)"
          accept=".pdf,.doc,.docx"
        /> */}

        <Button type="submit" variant="hero" className="w-full" size="lg">
          Submit Application
        </Button>
      </form>
    </Form>
  );
}

// Example with multistep form integration
export function MultistepFormExample() {
  const form = useForm({
    defaultValues: {
      step1: {
        projectId: "",
      },
      step2: {
        companyName: "",
        contactEmail: "",
        location: "",
      },
      step3: {
        projectDescription: "",
        fundingAmount: "",
      },
    },
  });

  return (
    <Form {...form}>
      <form className="space-y-6">
        {/* Step 1 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Step 1: Select Project</h3>
          <CustomFormField
            control={form.control}
            name="step1.projectId"
            fieldType={FormFieldType.SELECT}
            label="Select a Project"
            placeholder="Choose a funding opportunity"
            options={[
              { value: "1", label: "AgriTech Innovation Fund" },
              { value: "2", label: "Tech Startup Grant" },
            ]}
            required
          />
        </div>

        {/* Step 2 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Step 2: Company Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomFormField
              control={form.control}
              name="step2.companyName"
              fieldType={FormFieldType.INPUT}
              label="Company Name"
              icon={Building2}
              required
            />
            <CustomFormField
              control={form.control}
              name="step2.contactEmail"
              fieldType={FormFieldType.EMAIL}
              label="Contact Email"
              icon={Mail}
              required
            />
            <CustomFormField
              control={form.control}
              name="step2.location"
              fieldType={FormFieldType.INPUT}
              label="Location"
              icon={MapPin}
              required
            />
          </div>
        </div>

        {/* Step 3 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Step 3: Project Details</h3>
          <CustomFormField
            control={form.control}
            name="step3.projectDescription"
            fieldType={FormFieldType.TEXTAREA}
            label="Project Description"
            rows={6}
            required
          />
          <CustomFormField
            control={form.control}
            name="step3.fundingAmount"
            fieldType={FormFieldType.NUMBER}
            label="Funding Amount"
            min={1000}
            required
          />
        </div>
      </form>
    </Form>
  );
}









