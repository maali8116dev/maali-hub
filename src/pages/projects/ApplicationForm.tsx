import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import MultiStepApplicationForm from "@/components/application/MultiStepApplicationForm";
import { useApplicationFormStore } from "@/stores/applicationForm";
import ProtectedRoute from "@/components/ProtectedRoute";

const ApplicationFormContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateFormData } = useApplicationFormStore();

  // Set projectId from URL if available
  useEffect(() => {
    if (id) {
      updateFormData({ projectId: parseInt(id) });
    }
  }, [id, updateFormData]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(id ? `/projects/${id}` : "/projects")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {id ? "Back to Project Details" : "Back to Projects"}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Application Form</CardTitle>
            <CardDescription>
              {id 
                ? "Complete the form below to apply for this funding opportunity."
                : "Complete the form below to start your application."
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MultiStepApplicationForm />
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

const ApplicationForm = () => {
  return (
    <ProtectedRoute>
      <ApplicationFormContent />
    </ProtectedRoute>
  );
};

export default ApplicationForm;

