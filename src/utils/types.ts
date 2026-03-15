export type ProjectSystem = {
  name: string;
  description: string;
  techStack: string[];
  features: string[];
};

export type ProjectType = 'Professional' | 'Personal' | 'Game Jam' | 'Tool' | 'Prototype';

export type Project = {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  category: 'Unity' | 'Unreal Engine';
  thumbnail: string;
  tags: string[];
  projectType?: ProjectType;
  role?: string;
  company?: string;
  timeframe?: string;
  featured?: boolean;
  priority?: number;
  isSecret?: boolean;
  impact?: string[];
  challenges?: string[];
  systems: ProjectSystem[];
  demoUrl?: string;
  githubUrl?: string;
};

export type SectionProps = {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
};

export type ProjectCardProps = {
  project: Project;
  className?: string;
  onClick?: () => void;
}; 