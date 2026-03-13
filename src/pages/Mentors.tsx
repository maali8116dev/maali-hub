import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMentors } from "@/hooks/useMentors";
import { Search, Linkedin, Twitter, Globe, Users, MapPin, Briefcase } from "lucide-react";

const Mentors = () => {
  const { data: mentors, isLoading, error } = useMentors();
  const [searchTerm, setSearchTerm] = useState("");
  const [sectorFilter, setsectorFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Get unique sectors and countries for filters
  const sectors = [...new Set(mentors?.map(m => m.sector).filter(Boolean))] as string[];
  const countries = [...new Set(mentors?.map(m => m.country).filter(Boolean))] as string[];

  // Filter mentors
  const filteredMentors = mentors?.filter(mentor => {
    const matchesSearch = 
      mentor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mentor.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mentor.expertise_areas?.some(e => e.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchessector = sectorFilter === "all" || mentor.sector === sectorFilter;
    const matchesCountry = countryFilter === "all" || mentor.country === countryFilter;
    return matchesSearch && matchessector && matchesCountry;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Users className="h-4 w-4" />
              Mentorship Directory
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Connect with Expert Mentors
            </h1>
            <p className="text-lg text-muted-foreground">
              Learn from experienced entrepreneurs and industry leaders who are passionate about 
              helping African businesses succeed.
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filters */}
      <section className="py-8 border-b bg-card/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search mentors by name, expertise, or bio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sectorFilter} onValueChange={setsectorFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sectors</SelectItem>
                {sectors.map(sector => (
                  <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map(country => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Mentors Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-20 mt-4" />
                    <div className="flex gap-2 mt-4">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-destructive">Failed to load mentors. Please try again later.</p>
            </div>
          ) : filteredMentors?.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No mentors found</h3>
              <p className="text-muted-foreground">
                {searchTerm || sectorFilter !== "all" || countryFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Check back soon for new mentors"}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMentors?.map((mentor) => (
                <Card key={mentor.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={mentor.avatar_url || undefined} alt={mentor.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                          {getInitials(mentor.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{mentor.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                          {mentor.sector && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {mentor.sector}
                            </span>
                          )}
                          {mentor.country && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {mentor.country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {mentor.bio && (
                      <p className="text-sm text-muted-foreground mt-4 line-clamp-3">
                        {mentor.bio}
                      </p>
                    )}

                    {mentor.expertise_areas && mentor.expertise_areas.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {mentor.expertise_areas.slice(0, 3).map((expertise, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {expertise}
                          </Badge>
                        ))}
                        {mentor.expertise_areas.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{mentor.expertise_areas.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* External Links */}
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      {mentor.linkedin_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={mentor.linkedin_url} target="_blank" rel="noopener noreferrer">
                            <Linkedin className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {mentor.twitter_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={mentor.twitter_url} target="_blank" rel="noopener noreferrer">
                            <Twitter className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {mentor.website_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={mentor.website_url} target="_blank" rel="noopener noreferrer">
                            <Globe className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {!mentor.linkedin_url && !mentor.twitter_url && !mentor.website_url && (
                        <span className="text-sm text-muted-foreground">No external links available</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Want to Become a Mentor?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Share your expertise and help shape the next generation of African entrepreneurs. 
            Join our mentor network and make a lasting impact.
          </p>
          <Button asChild>
            <a href="/contact">Get in Touch</a>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Mentors;








