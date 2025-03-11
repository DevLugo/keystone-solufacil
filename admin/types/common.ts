export type Option = {
  label: string;
  value: string;
};

export type Route = {
  id: string;
  name: string;
};

export type Lead = {
  id: string;
  type: string;
  personalData: {
    fullName: string;
  };
};

export type PersonalData = {
  id: string;
  fullName: string;
  phones: Array<{ number: string }>;
};
