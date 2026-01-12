import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DollarSign, MapPin, Calendar, TrendingUp } from "lucide-react";

const SuccessStories = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const stories = [
    {
      id: 1,
      name: "Sarah Okafor",
      company: "AgriTech Solutions",
      category: "Agriculture",
      location: "Lagos, Nigeria",
      funding: "$50,000",
      date: "2023",
      image: "🌾",
      description: "Sarah used her funding to expand her agricultural technology platform, helping over 500 farmers increase crop yields by 40%.",
      impact: "500+ farmers supported, 40% yield increase"
    },
    {
      id: 2,
      name: "James Mwangi",
      company: "FinTech Innovations",
      category: "FinTech",
      location: "Nairobi, Kenya",
      funding: "$75,000",
      date: "2023",
      image: "💳",
      description: "James launched a mobile payment solution that now serves over 10,000 users across East Africa, improving financial inclusion.",
      impact: "10,000+ users, 5 countries"
    },
    {
      id: 3,
      name: "Amina Diallo",
      company: "EduTech Africa",
      category: "Education",
      location: "Dakar, Senegal",
      funding: "$30,000",
      date: "2024",
      image: "📚",
      description: "Amina created an online learning platform that provides affordable education to over 2,000 students in rural areas.",
      impact: "2,000+ students, 50+ courses"
    },
    {
      id: 4,
      name: "David Kofi",
      company: "Clean Energy Co.",
      category: "Energy",
      location: "Accra, Ghana",
      funding: "$100,000",
      date: "2023",
      image: "⚡",
      description: "David's solar energy solutions have brought electricity to 15 remote villages, impacting over 3,000 lives.",
      impact: "15 villages, 3,000+ people"
    },
    {
      id: 5,
      name: "Fatima Hassan",
      company: "HealthTech Solutions",
      category: "Healthcare",
      location: "Cairo, Egypt",
      funding: "$60,000",
      date: "2024",
      image: "🏥",
      description: "Fatima developed a telemedicine platform connecting patients in remote areas with healthcare professionals.",
      impact: "1,500+ consultations, 20+ doctors"
    },
    {
      id: 6,
      name: "Kwame Asante",
      company: "EcoWaste Management",
      category: "Environment",
      location: "Kumasi, Ghana",
      funding: "$40,000",
      date: "2023",
      image: "♻️",
      description: "Kwame's waste management system has recycled over 500 tons of waste and created 50+ jobs in his community.",
      impact: "500+ tons recycled, 50+ jobs"
    }
  ];

  const categories = Array.from(new Set(stories.map(s => s.category)));

  const filteredStories = selectedCategory === "all" 
    ? stories 
    : stories.filter(s => s.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Success Stories</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover how African entrepreneurs are transforming their communities and building successful businesses
            with funding from our platform.
          </p>
        </div>

        {/* Filter */}
        <div className="mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full md:w-auto">
                  <Label htmlFor="category-filter" className="mb-2 block">
                    Filter by Category
                  </Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="category-filter" className="w-full md:w-[200px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredStories.map((story) => (
            <Card key={story.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="text-6xl mb-4 text-center">{story.image}</div>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-xl">{story.company}</CardTitle>
                  <Badge variant="outline">{story.category}</Badge>
                </div>
                <CardDescription className="text-base font-medium">
                  {story.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{story.description}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">Funding: {story.funding}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{story.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Funded: {story.date}</span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-medium text-primary">{story.impact}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredStories.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No stories found for the selected category.</p>
            </CardContent>
          </Card>
        )}

        {/* CTA Section */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Ready to Write Your Success Story?</CardTitle>
            <CardDescription>
              Join these successful entrepreneurs and start your funding journey today.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/apply">
              <Button variant="hero">Start Your Application</Button>
            </a>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default SuccessStories;

