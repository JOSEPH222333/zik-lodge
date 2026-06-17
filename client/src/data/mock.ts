export type Role = "student" | "agent" | "admin";

export type Lodge = {
  id: string;
  title: string;
  location: string;
  university: string;
  price: number;
  type: "Self-contained" | "Single room" | "Flat" | "Shared apartment";
  distanceKm: number;
  availableRooms: number;
  status: "available" | "pending" | "occupied";
  verified: boolean;
  featured: boolean;
  rating: number;
  agent: string;
  phone: string;
  whatsapp: string;
  description: string;
  amenities: string[];
  images: string[];
};

export const lodges: Lodge[] = [
  {
    id: "green-haven-ifite",
    title: "Green Haven Lodge",
    location: "Ifite, Awka",
    university: "Nnamdi Azikiwe University",
    price: 420000,
    type: "Self-contained",
    distanceKm: 0.8,
    availableRooms: 6,
    status: "available",
    verified: true,
    featured: true,
    rating: 4.8,
    agent: "Adaeze Okafor",
    phone: "+234 803 111 2048",
    whatsapp: "https://wa.me/2348031112048",
    description:
      "Modern self-contained rooms with steady water, prepaid meter, tiled interior, and quick access to UNIZIK gate.",
    amenities: ["Water", "Prepaid meter", "Wardrobe", "Security", "Parking"],
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1560448075-bb485b067938?auto=format&fit=crop&w=1400&q=80"
    ]
  },
  {
    id: "royal-court-temp-site",
    title: "Royal Court Hostel",
    location: "Temp Site, Awka",
    university: "Nnamdi Azikiwe University",
    price: 280000,
    type: "Single room",
    distanceKm: 1.4,
    availableRooms: 11,
    status: "available",
    verified: true,
    featured: true,
    rating: 4.5,
    agent: "Chinedu Mbachu",
    phone: "+234 806 444 9190",
    whatsapp: "https://wa.me/2348064449190",
    description:
      "Budget-friendly student rooms with fenced compound, nearby food spots, and reliable access roads.",
    amenities: ["Security", "Water", "Shared kitchen", "Generator line"],
    images: [
      "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1400&q=80"
    ]
  },
  {
    id: "crest-view-perm-site",
    title: "Crest View Apartments",
    location: "Perm Site Road",
    university: "Nnamdi Azikiwe University",
    price: 760000,
    type: "Flat",
    distanceKm: 2.2,
    availableRooms: 3,
    status: "pending",
    verified: true,
    featured: false,
    rating: 4.7,
    agent: "Somto Nwosu",
    phone: "+234 901 338 7201",
    whatsapp: "https://wa.me/2349013387201",
    description:
      "Two-bedroom flat suitable for students sharing rent, with balcony, private kitchen, and POP finishing.",
    amenities: ["Balcony", "Private kitchen", "POP ceiling", "Parking", "Water"],
    images: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80"
    ]
  },
  {
    id: "campus-edge-amansea",
    title: "Campus Edge Residence",
    location: "Amansea",
    university: "Nnamdi Azikiwe University",
    price: 350000,
    type: "Shared apartment",
    distanceKm: 3.1,
    availableRooms: 8,
    status: "available",
    verified: false,
    featured: false,
    rating: 4.2,
    agent: "Emeka Umeh",
    phone: "+234 813 889 4923",
    whatsapp: "https://wa.me/2348138894923",
    description:
      "Shared apartment option for students who want a quieter axis with transport access to campus.",
    amenities: ["Shared kitchen", "Water", "Security", "Study area"],
    images: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80"
    ]
  }
];

export const agents = [
  { name: "Adaeze Okafor", verified: true, listings: 18, deals: 43, rating: 4.9 },
  { name: "Chinedu Mbachu", verified: true, listings: 27, deals: 61, rating: 4.7 },
  { name: "Somto Nwosu", verified: true, listings: 9, deals: 18, rating: 4.8 }
];

export const reports = [
  { id: "RPT-101", lodge: "Campus Edge Residence", reason: "Agent asked for inspection fee before viewing", status: "reviewing" },
  { id: "RPT-102", lodge: "Royal Court Hostel", reason: "Photos need verification", status: "resolved" }
];

export const deals = [
  { id: "DL-204", lodge: "Green Haven Lodge", student: "Ngozi E.", agent: "Adaeze Okafor", amount: 420000, commission: 42000, status: "confirmed" },
  { id: "DL-205", lodge: "Royal Court Hostel", student: "Kene O.", agent: "Chinedu Mbachu", amount: 280000, commission: 28000, status: "pending agent" }
];
