import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'pt', name: 'Português' }
  ];

  const navigationItems = [
    { href: '/', label: 'Home' },
    { href: '/projects', label: 'Projects' },
    { href: '/about', label: 'About' },
    { href: '/resources', label: 'Resources' },
    { href: '/contact', label: 'Contact' }
  ];

  return (
    <nav className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/">
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Maali
                </h1>
              </Link>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    location.pathname === item.href 
                      ? "text-primary bg-primary/10" 
                      : "text-foreground hover:text-primary"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Language Selector & CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="relative group">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {languages.find(lang => lang.code === currentLang)?.name}
              </Button>
              <div className="absolute right-0 mt-2 w-40 bg-card border border-border rounded-md shadow-soft opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setCurrentLang(lang.code)}
                    className={cn(
                      "block w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors",
                      currentLang === lang.code && "bg-muted text-primary"
                    )}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground">
                  Welcome back!
                </span>
                <Button variant="outline" onClick={signOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate("/auth")}>
                  Login
                </Button>
                <Button variant="hero" onClick={() => navigate("/auth")}>
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-foreground hover:text-primary p-2"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-card border-t border-border">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                  location.pathname === item.href 
                    ? "text-primary bg-primary/10" 
                    : "text-foreground hover:text-primary"
                )}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 pb-2 space-y-2">
              {user ? (
                <Button variant="outline" className="w-full" onClick={signOut}>
                  Sign Out
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                    Login
                  </Button>
                  <Button variant="hero" className="w-full" onClick={() => navigate("/auth")}>
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;