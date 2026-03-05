import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ArrowLeft, Search, FileQuestion } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-2xl">
          <Card className="border-2">
            <CardContent className="p-8 sm:p-12 text-center space-y-6">
              {/* 404 Number */}
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-primary/10 mb-4">
                  <FileQuestion className="h-12 w-12 sm:h-16 sm:w-16 text-primary" />
                </div>
                <h1 className="text-6xl sm:text-8xl font-bold text-primary">
                  404
                </h1>
                <h2 className="text-2xl sm:text-3xl font-semibold">
                  Page Not Found
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
                  Oops! The page you're looking for doesn't exist or has been moved.
                  Let's get you back on track.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4">
                <Button
                  onClick={() => navigate("/")}
                  size="lg"
                  className="min-h-[44px]"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
                <Button
                  onClick={() => navigate(-1)}
                  variant="outline"
                  size="lg"
                  className="min-h-[44px]"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
                <Button
                  onClick={() => navigate("/projects")}
                  variant="outline"
                  size="lg"
                  className="min-h-[44px]"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Browse Projects
                </Button>
              </div>

              {/* Helpful Links */}
              <div className="pt-6 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  You might be looking for:
                </p>
                <div className="flex flex-wrap justify-center gap-4 text-sm">
                  <a
                    href="/projects"
                    className="text-primary hover:underline transition-colors"
                  >
                    Projects
                  </a>
                  <a
                    href="/dashboard"
                    className="text-primary hover:underline transition-colors"
                  >
                    Dashboard
                  </a>
                  <a
                    href="/about"
                    className="text-primary hover:underline transition-colors"
                  >
                    About
                  </a>
                  <a
                    href="/contact"
                    className="text-primary hover:underline transition-colors"
                  >
                    Contact
                  </a>
                 
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
