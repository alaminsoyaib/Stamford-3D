import { officialStoryHeight } from './buildingFactory.js';
import { buildAcademicStairs } from './academicStairs.js';

export function academicBuildingOptions(kit) {
  return {
    upperFloorStory: officialStoryHeight,
    upperFloorWall: kit.materials.official,
    stairs: (section) => buildAcademicStairs(kit, section),
    title: 'ACADEMIC BUILDING', subtitle: 'GROUND ELEVATION', signWidth: 7.2,
    doors: [
      { x: -9.67, title: 'Academic Gate 02', width: 2.51, signWidth: 3.36, glass: true },
      { x: -3.46, title: 'Medical Center', subtitle: 'A-118  •  DOCTOR & PARAMEDIC', width: 1.65, signWidth: 2.89, cross: true, signColor: '#713936' },
      { x: 2.05, title: 'Student Welfare', subtitle: 'STUDENT SUPPORT OFFICE', width: 1.68, signWidth: 2.6, glass: true },
      { x: 8.19, title: 'Auditorium', width: 2.13, signWidth: 2.49, glass: true }
    ],
    windows: [{ x: -6.4, width: 1.46 }, { x: -0.56, width: 1.49 }, { x: 5.01, width: 1.65 }, { x: 11.48, width: 1.4 }]
  };
}
