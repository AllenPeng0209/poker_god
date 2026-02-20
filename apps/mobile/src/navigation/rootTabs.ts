export type RootTab = 'play' | 'learn' | 'review' | 'profile';

export type RootTabItem = {
  key: RootTab;
  label: string;
  icon: string;
};
