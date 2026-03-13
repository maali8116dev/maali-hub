import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin, Clock, MessageSquare, Users, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendContactConfirmationEmail, sendContactSubmissionEmail } from "@/lib/email";
import { useAuth } from "@/hooks/useAuth";
import { emailSchema } from "@/lib/emailValidation";

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100, "First name is too long"),
  lastName: z.string().min(1, "Last name is required").max(100, "Last name is too long"),
  email: emailSchema,
  phone: z.string().optional(),
  country: z.string().optional(),
  subject: z.enum(["funding", "application", "partnership", "technical", "general"], {
    required_error: "Please select a subject",
  }),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000, "Message is too long"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const Contact = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      country: "",
      subject: undefined,
      message: "",
    },
  });

  const selectedSubject = watch("subject");
  const selectedCountry = watch("country");

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      // Save to database
      const { data: submission, error: dbError } = await supabase
        .from("contact_submissions")
        .insert({
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone: data.phone || null,
          country: data.country || null,
          subject: data.subject,
          message: data.message,
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        toast.error("Failed to submit your message. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Send confirmation email to user
      const confirmationResult = await sendContactConfirmationEmail(
        data.email,
        data.firstName,
        data.message,
        submission.id
      );

      if (!confirmationResult.success) {
        console.error("Failed to send confirmation email:", confirmationResult.error);
        // Don't fail the submission if email fails
      }

      // Send notification email to admin
      const adminEmail = "support@maali.africa"; // TODO: Make this configurable
      const adminResult = await sendContactSubmissionEmail(
        adminEmail,
        data.firstName,
        data.lastName,
        data.email,
        data.phone || null,
        data.country || null,
        data.subject,
        data.message,
        submission.id
      );

      if (!adminResult.success) {
        console.error("Failed to send admin notification:", adminResult.error);
        // Don't fail the submission if email fails
      }

      setSubmitSuccess(true);
      toast.success("Your message has been sent successfully! We'll get back to you within 24 hours.");

      // Reset form after 3 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
        // Reset form
        setValue("firstName", "");
        setValue("lastName", "");
        setValue("email", "");
        setValue("phone", "");
        setValue("country", "");
        setValue("subject", undefined);
        setValue("message", "");
      }, 3000);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Email Us",
      content: "support@maali.africa",
      description: "We'll respond within 24 hours"
    },
    {
      icon: Phone,
      title: "Call Us",
      content: "+234 123 456 7890",
      description: "Mon-Fri, 9AM-6PM WAT"
    },
    {
      icon: MapPin,
      title: "Office",
      content: "Lagos, Nigeria",
      description: "Pan-African operations"
    },
    {
      icon: Clock,
      title: "Response Time",
      content: "24 hours",
      description: "Average response time"
    }
  ];

  const officeLocations = [
    {
      city: "Lagos",
      country: "Nigeria",
      address: "Victoria Island, Lagos State",
      role: "West Africa Hub"
    },
    {
      city: "Nairobi",
      country: "Kenya",
      address: "Westlands, Nairobi",
      role: "East Africa Hub"
    },
    {
      city: "Cape Town",
      country: "South Africa",
      address: "Century City, Cape Town",
      role: "Southern Africa Hub"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Contact Us
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get in touch with our team. We're here to help you succeed.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Send us a Message
                </CardTitle>
                <CardDescription>
                  Fill out the form below and we'll get back to you as soon as possible.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitSuccess ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-16 w-16 text-success mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Message Sent Successfully!</h3>
                    <p className="text-muted-foreground mb-4">
                      Thank you for contacting us. We've received your message and will respond within 24 hours.
                    </p>
                    <Button onClick={() => setSubmitSuccess(false)} variant="outline">
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          placeholder="Enter your first name"
                          className="h-12 sm:h-10"
                          {...register("firstName")}
                        />
                        {errors.firstName && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          placeholder="Enter your last name"
                          className="h-12 sm:h-10"
                          {...register("lastName")}
                        />
                        {errors.lastName && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email address"
                        className="h-12 sm:h-10"
                        {...register("email")}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter your phone number"
                        className="h-12 sm:h-10"
                        {...register("phone")}
                      />
                      {errors.phone && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.phone.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select
                        value={selectedCountry}
                        onValueChange={(value) => setValue("country", value)}
                      >
                        <SelectTrigger className="h-12 sm:h-10">
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nigeria">Nigeria</SelectItem>
                          <SelectItem value="kenya">Kenya</SelectItem>
                          <SelectItem value="south-africa">South Africa</SelectItem>
                          <SelectItem value="ghana">Ghana</SelectItem>
                          <SelectItem value="uganda">Uganda</SelectItem>
                          <SelectItem value="tanzania">Tanzania</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.country && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.country.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject *</Label>
                      <Select
                        value={selectedSubject}
                        onValueChange={(value) => setValue("subject", value as ContactFormData["subject"])}
                      >
                        <SelectTrigger className="h-12 sm:h-10">
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="funding">Funding Inquiry</SelectItem>
                          <SelectItem value="application">Application Support</SelectItem>
                          <SelectItem value="partnership">Partnership</SelectItem>
                          <SelectItem value="technical">Technical Support</SelectItem>
                          <SelectItem value="general">General Inquiry</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.subject && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.subject.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message *</Label>
                      <Textarea
                        id="message"
                        placeholder="Tell us how we can help you..."
                        className="min-h-[120px]"
                        {...register("message")}
                      />
                      {errors.message && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.message.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full min-h-[48px]"
                      variant="hero"
                      size="lg"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Message"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contactInfo.map((info, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <info.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{info.title}</h4>
                      <p className="font-semibold text-sm">{info.content}</p>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Office Locations</CardTitle>
                <CardDescription>
                  We operate across Africa with regional hubs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {officeLocations.map((office, index) => (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-foreground">{office.city}, {office.country}</h4>
                    <p className="text-sm text-muted-foreground">{office.address}</p>
                    <p className="text-xs text-primary font-medium mt-1">{office.role}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gradient-primary text-white">
              <CardContent className="p-6 text-center">
                <h3 className="font-bold text-lg mb-2">Quick Support</h3>
                <p className="text-sm opacity-90 mb-4">
                  Need immediate assistance? Check our FAQ section or schedule a call with our team.
                </p>
                <div className="space-y-2">
                  <Button variant="secondary" size="sm" className="w-full" asChild>
                    <Link to="/faq">View FAQ</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
                    Schedule Call
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center bg-gradient-subtle rounded-2xl p-8 md:p-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Don't wait -explore funding opportunities available right now
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" asChild>
              <Link to="/projects">Browse Projects</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/auth">Create Account</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;








