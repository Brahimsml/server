import RTX from "../Assets/4090RTX.jpg"
import RTXX from "../Assets/4080RTX.jpg"
import TX from "../Assets/7900.png"
import TXX from "../Assets/4070.jpg"
import TXXX from "../Assets/7800 XT.jpg"
import TXXXX from "../Assets/4060.jpg"
 import ultraWide from "../Assets/ultraWide.jpg"     
  import ultraWidee from "../Assets/4k.jpg"  
   import ultraWideee from "../Assets/ipps.jpg" 
      import ultraWideo from "../Assets/curved.jpg" 
         import ultraWideoo from "../Assets/hz.jpg" 
         import ultraWideooe from "../Assets/hdr.webp" 
         import lap from "../Assets/lap.jpg"  
   import lapp from "../Assets/lapp.webp" 
      import lappp from "../Assets/lappp.jpg" 
         import lapo from "../Assets/lapo.jpg" 
         import lapoo from "../Assets/Creator Laptop i7 RTX 4060.jpg" 
     import ky from "../Assets/ky.jpg" 
     import mouse from "../Assets/mouse.jpg" 
     import headset from "../Assets/headset.webp" 
     import mousepad from "../Assets/mousepad.jpg" 
     import usb from "../Assets/usb.jpg"
     import webcam from "../Assets/webcam.jpg" 
     import chair from "../Assets/chair.webp" 


export const categories = [
  {
    name: "Graphics Cards",
    products: [
      { id: 1, name: "NVIDIA RTX 4090", price: "$1,599", image: RTX, label: "Best Seller", description: "Ultimate 4K gaming GPU with AI acceleration." },
      { id: 2, name: "NVIDIA RTX 4080", price: "$1,199", image: RTXX, label: "New", description: "High-end performance for gamers and content creators." },
      { id: 3, name: "AMD RX 7900 XT", price: "$999", image: TX, description: "AMD flagship GPU for smooth high-res gaming." },
      { id: 4, name: "NVIDIA RTX 4070 Ti", price: "$799", image:TXX, description: "Excellent balance of power and efficiency." },
      { id: 5, name: "AMD RX 7800 XT", price: "$699", image: TXXX, description: "Great value for high-frame-rate gaming." },
      { id: 6, name: "NVIDIA RTX 4060", price: "$499", image: TXXXX, description: "Budget-friendly gaming with RTX features." }
    ]
  },
  {
    name: "Monitors",
    products: [
      { id: 7, name: "UltraWide 34\" 144Hz", price: "$499", image: ultraWide, label: "New", description: "Immersive 21:9 screen for multitasking and gaming." },
      { id: 8, name: "4K Gaming Monitor", price: "$699", image: ultraWidee, description: "Crystal-clear visuals with 144Hz refresh rate." },
      { id: 9, name: "27\" 144Hz IPS", price: "$399", image: ultraWideee, description: "Fast IPS panel for competitive gamers." },
      { id: 10, name: "32\" QHD Curved", price: "$549", image: ultraWideo, label: "Best Seller", description: "Curved screen for immersive gameplay." },
      { id: 11, name: "32\" 240Hz Gaming", price: "$799", image: ultraWideoo, description: "Ultra-fast refresh rate for esports pros." },
      { id: 12, name: "27\" 4K HDR", price: "$599", image: ultraWideooe, description: "HDR for vibrant colors and sharp details." }
    ]
  },
  {
    name: "Laptops",
    products: [
      { id: 13, name: "Gaming Laptop RTX 4070", price: "$1,299", image: lap, label: "New", description: "Portable gaming powerhouse with RTX graphics." },
      { id: 14, name: "Ultra Laptop RTX 4060", price: "$1,099", image: lapp, description: "Slim, lightweight laptop for work and play." },
      { id: 15, name: "Pro Laptop i9 RTX 4060", price: "$1,499", image: lappp, description: "High-performance laptop for creators." },
      { id: 16, name: "Slim Laptop RTX 4050", price: "$999", image: lapo, description: "Thin design with solid gaming performance." },
      { id: 17, name: "Creator Laptop i7 RTX 4060", price: "$1,299", image: lapoo, description: "Optimized for content creation and gaming." }
    ]
  },
  {
    name: "Peripherals",
    products: [
      { id: 18, name: "Mechanical Keyboard RGB", price: "$129", image:ky, description: "Tactile switches with customizable RGB lighting." },
      { id: 19, name: "Wireless Gaming Mouse", price: "$89", image: mouse, description: "Ergonomic, low-latency mouse for pro gaming." },
      { id: 20, name: "Premium Gaming Headset", price: "$199", image: headset, label: "Best Seller", description: "Immersive sound and crystal-clear mic." },
      { id: 21, name: "RGB Mousepad", price: "$49", image: mousepad, description: "Smooth surface with customizable RGB glow." },
      { id: 22, name: "USB-C Hub", price: "$59", image: usb, description: "Connect multiple devices with fast transfer." },
      { id: 23, name: "Webcam 1080p", price: "$79", image:webcam, description: "Clear video for streaming and calls." },
      { id: 24, name: "Gaming Chair", price: "$399", image: chair, description: "Comfortable design for long gaming sessions." }
    ]
  }
];

