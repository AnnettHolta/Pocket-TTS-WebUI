// Hugging Face file sizes and SHA-256 digests for this exact model revision.
export const MODEL_REPO = "stephvax/pocket-tts-onnx";
export const MODEL_REVISION = "9dd58b75ba672bb75df1c62a493f6db7c80de6d1";
export const DEFAULT_MODEL_LANGUAGE = "english_2026-10";
export const MODEL_RESOLVE_BASE = `https://huggingface.co/${MODEL_REPO}/resolve/${MODEL_REVISION}/onnx`;

export function modelBasePath(languageId: string): string {
  return `/models/pocket-tts/${MODEL_REVISION}/${languageId}`;
}

export interface ModelFile {
  size: number;
  sha256: string;
}

export const MODEL_FILES: Readonly<Record<string, ModelFile>> = {
  "english_2026-10/bos_before_voice.npy": { size: 4224, sha256: "ba091d858b647e7a1d7e57f3436ecbb03d97bb250fdeae61368d4cd1b6f3d5ea" },
  "english_2026-10/bundle.json": { size: 680, sha256: "579547eccf1702a5ba313e386be213c92babcefa89640926ef6cad7dd080437a" },
  "english_2026-10/flow_lm_flow.onnx": { size: 39081891, sha256: "91f757089899345b548ed9d99bcf07988fe544cf4e9466a85d9ff4a0fbfd0489" },
  "english_2026-10/flow_lm_flow_int8.onnx": { size: 9935594, sha256: "a86f58284d7885f325ebb238d40782be9716dc1e1149dc2469f113dac9f033f5" },
  "english_2026-10/flow_lm_main_int8.onnx": { size: 75865936, sha256: "2a14cf05cac01461aa596229a05bda4378b135004048ef1ec1db728b4d1ab958" },
  "english_2026-10/mimi_decoder.onnx": { size: 41422037, sha256: "4fb0145caba7e554419426a68535e3b411c1ed0e182057186770c924d71ad4d1" },
  "english_2026-10/mimi_decoder_int8.onnx": { size: 22629895, sha256: "5cd57aa7a3f1439b9b63da03cd39f3cfb0b2a48acf0e1b1628a2f256ec419b67" },
  "english_2026-10/mimi_encoder.onnx": { size: 39269324, sha256: "27a8ae66061b389bab09f18083005c2e4d5be6f4eaa34c8db8988f52fd6acc55" },
  "english_2026-10/text_conditioner.onnx": { size: 16388310, sha256: "3573df3fe6d0b1e72588ed5b021ab11514e67a4432c20a2bea783170260f5020" },
  "english_2026-10/tokenizer.model": { size: 59339, sha256: "d461765ae179566678c93091c5fa6f2984c31bbe990bf1aa62d92c64d91bc3f6" },
  "french_24l/bos_before_voice.npy": { size: 4224, sha256: "6090fda20037a969d94aadfead53d29cf7bdb088365f548dfd4715f046a4441b" },
  "french_24l/bundle.json": { size: 979, sha256: "e656007076581e486f856e9aada6deba78b533fe2435fa6bfbb33387fa8d8133" },
  "french_24l/flow_lm_flow.onnx": { size: 39081891, sha256: "75c829d567a0195e1fd66367af1652b03a991411db257bec64fef5a63ea9b126" },
  "french_24l/flow_lm_flow_int8.onnx": { size: 9935594, sha256: "369622a271844534998d670ca29e95e13499e3082c99aff0b9af9b1902f7edb0" },
  "french_24l/flow_lm_main_int8.onnx": { size: 303347168, sha256: "30c9c88bc82e7d69c09400c6c8f0c9fc80c7dfc1b7acc401a38f61075e12e549" },
  "french_24l/mimi_decoder.onnx": { size: 41414681, sha256: "dc65d4f0a1fa2ff2b9892efbce1f277222886a889ba73780ee180ccdb4c00d85" },
  "french_24l/mimi_decoder_int8.onnx": { size: 22620074, sha256: "d98af073bb6478f91c74caf8e0b9440c2926009ea45f94432850c16a0e91c144" },
  "french_24l/mimi_encoder.onnx": { size: 39261982, sha256: "4165b6a1b83ca22f73f2f82433dac5bb3cb4b78e49da95f1a4f139c3d9ce2aae" },
  "french_24l/text_conditioner.onnx": { size: 16388310, sha256: "d5bcb347e0dfde1a7a196b18e6640b71505a0717f2ce5167b3d6f9744ab85d4a" },
  "french_24l/tokenizer.model": { size: 60690, sha256: "dd8dc8cfad3c4b3711a8629ede27d5be934eb98bcb00462bf91ed40fb8f6f38a" },
  "german_24l/bos_before_voice.npy": { size: 4224, sha256: "39694b2b0fe32e4a1f61190b2b0630f4cbcd5065c37078132765166bc783966d" },
  "german_24l/bundle.json": { size: 1003, sha256: "007d9996669de917fde4ec6e1a98c420115504e9029fdedb3f81a3acb795297f" },
  "german_24l/flow_lm_flow.onnx": { size: 39081891, sha256: "8cc94022cb47d3bc1dde7e2c002a40bbc158daefec2e12fb4116a1ea4bc8d3c3" },
  "german_24l/flow_lm_flow_int8.onnx": { size: 9935594, sha256: "0591bf69e0cb6de77c04f594e262fb3338fd36efabeebf7db9c6b4f2988d6723" },
  "german_24l/flow_lm_main_int8.onnx": { size: 303347168, sha256: "769378926449ba8dc8a797e4d1e2478c306d1e9cad8323e2d4721d5902a8f639" },
  "german_24l/mimi_decoder.onnx": { size: 41422037, sha256: "f4d0a2d56bb2956ae19ae492b4dbda7cf6c1f4c306f3cff1c9614285e4efdbfd" },
  "german_24l/mimi_decoder_int8.onnx": { size: 22629895, sha256: "50abebc117e481d9baac9765ba5f454a13b1ed9cf54f39239ccef2e03ec8fe86" },
  "german_24l/mimi_encoder.onnx": { size: 39269324, sha256: "b4fcaeab1c4c41793a58825098d5f34e958d128ef4cbdd151bef0f579ecbf3a4" },
  "german_24l/text_conditioner.onnx": { size: 16388310, sha256: "73140539231ef523105d5d3ea7f008c0d1863ee195eae53199281b4350d9c4a9" },
  "german_24l/tokenizer.model": { size: 60347, sha256: "b3d6fb751a0bbc0b18df78687a03c11e4f2fbb0fa4b8f85e83064cd9d80ee34b" },
  "italian_24l/bos_before_voice.npy": { size: 4224, sha256: "e8daccbcd0783e66684ff51e9cc20928704408aa1b7261de16815cbaffde3444" },
  "italian_24l/bundle.json": { size: 987, sha256: "3452a1a04975b3031eea5e6d2b5651fd12df72781a3118507dc962ddc0c282ea" },
  "italian_24l/flow_lm_flow.onnx": { size: 39081891, sha256: "8b4668cfe0f97801083dd6c3cbf7ede88a95ecfd377ab6f7247c89613f8b875b" },
  "italian_24l/flow_lm_flow_int8.onnx": { size: 9935594, sha256: "54142c6eadf3b9cfef9d87a3bcd32d1f73974d53adaded76c0c627915f60e69e" },
  "italian_24l/flow_lm_main_int8.onnx": { size: 303347168, sha256: "7ed90dafce36b4d0553dcdf749f30356a67b85418b16e13b3a512400a3a2e2af" },
  "italian_24l/mimi_decoder.onnx": { size: 41422037, sha256: "6b203a81b4150a27e7689d0d7bf9a2a808ae3eabbf8c2a0d9e2ad9afed3041bb" },
  "italian_24l/mimi_decoder_int8.onnx": { size: 22629895, sha256: "ce8a878169fb3702aa9b79fff2125c08da45ea57a166e7f35e07f37b14563b1c" },
  "italian_24l/mimi_encoder.onnx": { size: 39269324, sha256: "da2fb72ad85db311c21316d416d516297853c025c8ff0abdc26e007d633c2600" },
  "italian_24l/text_conditioner.onnx": { size: 16388310, sha256: "ec34e6160521f8e72b10b820018a1262a9ec78eb8cbf3f87871035936aab5bc6" },
  "italian_24l/tokenizer.model": { size: 60905, sha256: "1ef32ed65d0264239fb9d9ecb36a089a637f6e6c5c5a1a8e7df37ce486ec21da" },
  "portuguese_24l/bos_before_voice.npy": { size: 4224, sha256: "5489631fdfd88227d20a3f462128fe09bd9fa65cf4c0efdc0473a414698e6d07" },
  "portuguese_24l/bundle.json": { size: 993, sha256: "404010fa0d9ffc1a24497e485c45e6e00581585a4af88987d1a2e8d582955791" },
  "portuguese_24l/flow_lm_flow.onnx": { size: 39081891, sha256: "c3eb4251bef0ec31b968a800a2a94e51e3c2e66ab2af87c0d5eacfe64e46028d" },
  "portuguese_24l/flow_lm_flow_int8.onnx": { size: 9935594, sha256: "756922268b41acbe2ad88fad38e482a0d727f4c652d3c1ffb2202dac3e223bce" },
  "portuguese_24l/flow_lm_main_int8.onnx": { size: 303347168, sha256: "f4f4ebae0f81009c5bf9d5838269d6f146f45dddb130e88f8c39190c8ac746de" },
  "portuguese_24l/mimi_decoder.onnx": { size: 41422037, sha256: "c5ee53c2a38c7356844f95b49d160787e4d30ad54687b82ac23a18d3a2febb5b" },
  "portuguese_24l/mimi_decoder_int8.onnx": { size: 22629895, sha256: "7c808cd0f388b35752e52b8998d0e3be49377d25b2def6110986f412822bc081" },
  "portuguese_24l/mimi_encoder.onnx": { size: 39269324, sha256: "32138fbc4ebf37b513d709209bf0bbb7e40e02d536eef6788a7a08198fce7e14" },
  "portuguese_24l/text_conditioner.onnx": { size: 16388310, sha256: "19d8246da83be293d9c10f4ba8291e1217bd67e5df7a9544405e44b463bc2530" },
  "portuguese_24l/tokenizer.model": { size: 61351, sha256: "fe9db388dc987c8a26bb88789d2f20989e68e00d8534442a141ecccec21cedba" },
  "spanish_24l/bos_before_voice.npy": { size: 4224, sha256: "c99a5035f90cd31d3e16cbbc51ed101c67a237a15002ccc59326bb21f1bc1b25" },
  "spanish_24l/bundle.json": { size: 1023, sha256: "38b210c4c57c17f97353244d12bb30ace8fbcfe5c1abc34bceb09c219f27bd34" },
  "spanish_24l/flow_lm_flow.onnx": { size: 39081891, sha256: "4722755c7aad8bf4ba6ce4edca6956db3d2d8bcb8412527031ddb4a14bab958a" },
  "spanish_24l/flow_lm_flow_int8.onnx": { size: 9935594, sha256: "c2072b0b575c7244649e6c89628ab852ca5ef2b03588242f70362cf8ef9fa224" },
  "spanish_24l/flow_lm_main_int8.onnx": { size: 303347168, sha256: "b751f3a068fe8255bb060efcd5afd53be8ad11e6f4a72b80686ab42068b6558b" },
  "spanish_24l/mimi_decoder.onnx": { size: 41422037, sha256: "43805c76c0366e052ac1036427ee0ead58f80b398c91a47859b232ad3a779cd6" },
  "spanish_24l/mimi_decoder_int8.onnx": { size: 22629895, sha256: "b9f704daf79f3b2a342adc221db9d10a2caf0e44468a68d6fbde28a048408836" },
  "spanish_24l/mimi_encoder.onnx": { size: 39269324, sha256: "c0bb4491187c0c6314aa6a8c6ab734106a7aba4257e3bef81c1a10f3e4063641" },
  "spanish_24l/text_conditioner.onnx": { size: 16388310, sha256: "f082f15f915e3ab948c2e092a9ea4b5ee22e036b375566bc91d2c28903ec7764" },
  "spanish_24l/tokenizer.model": { size: 61063, sha256: "9714c8ce180d8147ab4c1406cd759619828f95d7000c87c41dc9ccec527a3e89" },
};
