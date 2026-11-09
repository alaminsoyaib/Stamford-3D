# PROJECT CONTEXT: Interactive 3D Virtual Campus & Deep-Sea Portal

## 1. Course & Rubric Requirements (35/40 Marks Total)
- **Framework:** Three.js (WebGL) using HTML5, ES6 JavaScript modules, PointerLockControls, and GLTFLoader.
- **Team Size:** 3 Members.
- **Key Graded Criteria:**
  1. **Implementation & Functionality (5 Marks):** Smooth execution, animations, interactions, and transformations.
  2. **Creativity & Originality (5 Marks):** First-person campus tour connected to an underwater Doraemon-style teleportation ring.
  3. **Modeling & Graphics Techniques (10 Marks):** 3D modeling, geometric transformations (translation, rotation, scaling), lighting, textures, and math-driven animations (sine-wave water/fish motion).
  4. **User Interaction & Controls (5 Marks):** First-person WASD + Mouse look roaming, collision detection, and keyboard environment toggles.
  5. **Weather, Season & Aesthetics (10 Marks):** Clear, realistic visuals featuring Day/Night transitions, dynamic lighting, and rain/weather particle effects.
  6. **Documentation (5 Marks):** Full source code and screenshots of different moods/stages included in the final report.

## 2. Project Scope & Architecture
- **Scene 1: Stamford University Campus (Exterior Only)**
  - First-person walking tour (`PointerLockControls`, eye height locked at `y = 1.7`).
  - **Strict Exterior-Only Rule:** Users can roam freely on roadways, footpaths, the garden, and the main ground, but 2D bounding-box collisions prevent entering any buildings, stairs, washrooms, or the canteen.
  - **Key Landmarks:** Main Entry Gate, Guard Room, Garden (with benches, flowers, trees), Main CSE Building, Admission Wing exterior, Varsity Bus parking spot, CSE Library exterior & Bag Counter, Male Washroom exterior, Pharmacy Library exterior, Central Ground, Academic Building, Civil Building, Medical Center, Student Welfare room, Canteen exterior, and the Swimming Pool at the far end of the ground.
- **Scene 2: The Doraemon Underwater Portal & Deep-Sea Descent**
  - Located at the bottom of the swimming pool is a glowing deep-blue ring (`THREE.TorusGeometry` with cyan/blue emissive glow, inspired by Doraemon's gadget).
  - Entering the ring transitions/loads a separate Three.js scene (`underwater.js` / `underwater.html`).
  - As the user descends deeper (`-Y` axis), exponential fog (`THREE.FogExp2`) darkens from sunlit aqua to abyssal navy, revealing layered sea life: shallow coral reefs & tropical fish, mid-water schooling fish/turtles, and deep-sea bioluminescent creatures.

## 3. Collected & Renamed Campus Samples (`CG_Sessional` Folder - 79 Items)
The reference photos are sequentially numbered to represent a continuous physical walkthrough from the outside gate to the main ground:
- **Subfolder:** `Extra minor details breakdown`
- **Zone A (Gate, Guard Room & Garden):**
  - `1-Campus Gate outside.jpg`, `2-Guard Room.jpg`, `3-Campus gate inside view.jpg`, `4- Guard room and gurdian room.jpg`, `5-View right after entering from campus gate.jpg`, `6- rightside of campus gate 1.jpg`, `7- rightside of campus gate 2.jpg`, `8- Bench on Garden on side of campus gate.jpg`, `9- Garden view some flowers in the center and far left cse building...jpg`
- **Zone B (Main CSE Building, Official Building & Admission Wing):**
  - `7- CSE building or Main building view from garden.jpg`, `10- Beneath CSE building 1.jpg`, `11- Beneath CSE Building 2.jpg`, `12- Right Side of CSE Building (Official Building).jpg`, `13- Admission wing on ground floor of Official Building.jpg`, `14- Admission wing door.jpg`, `15-left of Admission wing entry.jpg`, `16- Right side of admission wing entry.jpg`, `17- Another angle of Official Building.jpg`, `17- View of Garden from infront of the admission wing.jpg`, `18- Moving forward from Admissiong Building, Versity Bus and and on right is...jpg`, `19- Closer look of the tree beside versity bus.jpg`
- **Zone C (Libraries, Washroom Exterior & Corridor to Ground):**
  - `20- Closer look at the room which can be seen in the image 18.jpg`, `20- Moving forward cse library by truning left from the Versity Buses.jpg`, `21- Male washroom beside the room of image 19.jpg`, `22- Moving forward from male washroom.jpg`, `23- Left side view from the male washroom where forward is the cs...jpg`, `24- Cse Library.jpg`, `25- on right side of CSE library which heads to the law building.jpg`, `26- Closer look to the bag counter of the cse library.jpg`, `27- another view from the CSE library moving straight to the garden.jpg`, `28- gate of the cse library.jpg`, `29- Moving Towards Ground, on front left is Pharmacy library.jpg`, `30- Pharmacy Library.jpg`, `31- Pharmacy Library.jpg`
- **Zone D (Central Ground, Academic Building, Medical Center & Pool):**
  - `32- Ground view when heading from library.jpg`, `33- Another corner of the Academic Building on the side of ground and op...jpg`, `34- Left is academic building and right is ground.jpg`, `35- 2nd gate of academic building, first gate was on the admission wing.jpg`, `36- moving from academic building.jpg`, `37- Medical Center beside the 2nd gate of academic building.jpg`, `38- Closer look at the door of Medical center.jpg`, `39- Student Welfare room beside the medical center.jpg`, `40- Academic building from the side of ground where bottom roo...jpg` (+ remaining ground, canteen, civil building, and pool samples).