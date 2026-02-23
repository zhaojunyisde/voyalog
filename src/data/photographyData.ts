export interface PhotoPoint {
    id: string;
    coordinates: [number, number];
    thumbnailUrl: string;
    fullImageUrl: string;
    locationName: string;
    date: string;
    description?: string;
}

// NOTE: Replace these with your actual Cloudinary URLs once you set up your account.
// Notice how the 'thumbnailUrl' uses 'w_100,h_100,c_fill' to generate a tiny optimized circle,
// while 'fullImageUrl' just uses 'w_1600' for the high-res view.
export const SAMPLE_PHOTOS: PhotoPoint[] = [
    // NORTH AMERICA
    {
        id: '1',
        coordinates: [40.7128, -74.0060],
        thumbnailUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1600',
        locationName: 'New York City, USA',
        date: '2026',
        description: 'Vibrant street view in the heart of Manhattan.'
    },
    {
        id: '2',
        coordinates: [37.7749, -122.4194],
        thumbnailUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1600',
        locationName: 'San Francisco, USA',
        date: '2025',
        description: 'The iconic Golden Gate Bridge.'
    },
    {
        id: '3',
        coordinates: [51.1784, -115.5708],
        thumbnailUrl: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1600',
        locationName: 'Banff National Park, Canada',
        date: '2025',
        description: 'Pristine mountain lakes and pine forests.'
    },
    {
        id: '4',
        coordinates: [19.4326, -99.1332],
        thumbnailUrl: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1600',
        locationName: 'Mexico City, Mexico',
        date: '2024'
    },
    {
        id: '5',
        coordinates: [23.1136, -82.3666],
        thumbnailUrl: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=1600',
        locationName: 'Havana, Cuba',
        date: '2024'
    },

    // SOUTH AMERICA
    {
        id: '6',
        coordinates: [-22.9068, -43.1729],
        thumbnailUrl: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1600',
        locationName: 'Rio de Janeiro, Brazil',
        date: '2023'
    },
    {
        id: '7',
        coordinates: [-34.6037, -58.3816],
        thumbnailUrl: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1600',
        locationName: 'Buenos Aires, Argentina',
        date: '2023'
    },
    {
        id: '8',
        coordinates: [-13.1631, -72.5450],
        thumbnailUrl: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=1600',
        locationName: 'Machu Picchu, Peru',
        date: '2022',
        description: 'Ancient Incan citadel set high in the Andes.'
    },
    {
        id: '9',
        coordinates: [-50.9423, -73.4068],
        thumbnailUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600',
        locationName: 'Patagonia, Chile',
        date: '2022'
    },
    {
        id: '10',
        coordinates: [4.7110, -74.0721],
        thumbnailUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1600',
        locationName: 'Bogota, Colombia',
        date: '2021'
    },

    // EUROPE
    {
        id: '11',
        coordinates: [48.8566, 2.3522],
        thumbnailUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1600',
        locationName: 'Paris, France',
        date: '2024'
    },
    {
        id: '12',
        coordinates: [51.5074, -0.1278],
        thumbnailUrl: 'https://images.unsplash.com/photo-1528642474498-1af0c17fd8c3?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1528642474498-1af0c17fd8c3?w=1600',
        locationName: 'London, UK',
        date: '2023'
    },
    {
        id: '13',
        coordinates: [41.9028, 12.4964],
        thumbnailUrl: 'https://images.unsplash.com/photo-1530841377377-3ff06c0ca713?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1530841377377-3ff06c0ca713?w=1600',
        locationName: 'Rome, Italy',
        date: '2023'
    },
    {
        id: '14',
        coordinates: [36.3932, 25.4615],
        thumbnailUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1600',
        locationName: 'Santorini, Greece',
        date: '2022'
    },
    {
        id: '15',
        coordinates: [64.1466, -21.9426],
        thumbnailUrl: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1600',
        locationName: 'Reykjavik, Iceland',
        date: '2021'
    },

    // AFRICA
    {
        id: '16',
        coordinates: [30.0444, 31.2357],
        thumbnailUrl: 'https://images.unsplash.com/photo-1506459225024-1428097a7e18?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1506459225024-1428097a7e18?w=1600',
        locationName: 'Cairo, Egypt',
        date: '2026'
    },
    {
        id: '17',
        coordinates: [-33.9249, 18.4241],
        thumbnailUrl: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1600',
        locationName: 'Cape Town, South Africa',
        date: '2025'
    },
    {
        id: '18',
        coordinates: [31.6295, -7.9811],
        thumbnailUrl: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=1600',
        locationName: 'Marrakech, Morocco',
        date: '2024'
    },
    {
        id: '19',
        coordinates: [-2.3333, 34.8333],
        thumbnailUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1600',
        locationName: 'Serengeti, Tanzania',
        date: '2023'
    },
    {
        id: '20',
        coordinates: [-17.9244, 25.8567],
        thumbnailUrl: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1600',
        locationName: 'Victoria Falls, Zimbabwe',
        date: '2022'
    },

    // ASIA
    {
        id: '21',
        coordinates: [35.6762, 139.6503],
        thumbnailUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600',
        locationName: 'Tokyo, Japan',
        date: '2025'
    },
    {
        id: '22',
        coordinates: [35.0116, 135.7681],
        thumbnailUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1600',
        locationName: 'Kyoto, Japan',
        date: '2024'
    },
    {
        id: '23',
        coordinates: [13.7563, 100.5018],
        thumbnailUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1600',
        locationName: 'Bangkok, Thailand',
        date: '2024'
    },
    {
        id: '24',
        coordinates: [-8.3405, 115.0920],
        thumbnailUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600',
        locationName: 'Bali, Indonesia',
        date: '2023'
    },
    {
        id: '25',
        coordinates: [25.2048, 55.2708],
        thumbnailUrl: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1600',
        locationName: 'Dubai, UAE',
        date: '2022'
    },

    // OCEANIA
    {
        id: '26',
        coordinates: [-33.8688, 151.2093],
        thumbnailUrl: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1600',
        locationName: 'Sydney, Australia',
        date: '2026'
    },
    {
        id: '27',
        coordinates: [-36.8485, 174.7633],
        thumbnailUrl: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1600',
        locationName: 'Auckland, New Zealand',
        date: '2025'
    },

    {
        id: '29',
        coordinates: [-16.5004, -151.7415],
        thumbnailUrl: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600',
        locationName: 'Bora Bora, French Polynesia',
        date: '2023'
    },
    {
        id: '30',
        coordinates: [-37.8136, 144.9631],
        thumbnailUrl: 'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=150&h=150&fit=crop',
        fullImageUrl: 'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1600',
        locationName: 'Melbourne, Australia',
        date: '2022'
    }
];
