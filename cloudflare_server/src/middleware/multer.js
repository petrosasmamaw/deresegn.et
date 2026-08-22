/** Uploads are handled by Hono multipartFile() — this stub keeps import paths stable. */
export const topUpUpload = {
  single() {
    throw new Error('Use multipartFile("screenshot") Hono middleware instead of multer');
  },
};

export const checkUpload = topUpUpload;
