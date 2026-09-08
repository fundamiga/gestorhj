import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dcbftuglo',
  api_key: process.env.CLOUDINARY_API_KEY || '767474183312719',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'E9O8ZRFcAeZukIc5HUsBu-S-r8o',
  secure: true,
});

export default cloudinary;
